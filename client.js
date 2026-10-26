window.__ModuleLoader__.load({
  id: 'dsh-composer-history',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Page global the Host half writes. */
    const GLOBAL_NAME = '__DSH_COMPOSER_HISTORY__';
    /** Locale namespace (only used if a future build shows a settings row). */
    const NS = 'composer-history';
    /** Invisible marker the entry renders, so a scoped rule can collapse its slot wrapper. */
    const MARKER = 'data-dsh-composer-history';

    const zh = { 'hint': '输入框为空时按 ↑ 回填上一条消息，↓ 往回，Esc 退出' };
    const en = { 'hint': 'Press ↑ on an empty composer to recall the previous message, ↓ to go forward, Esc to leave' };

    /** Read the published configuration with defaults. */
    function readConfig() {
      const value = typeof window === 'undefined' ? undefined : window[GLOBAL_NAME];
      const raw = value !== null && typeof value === 'object' ? value : {};
      return {
        enabled: raw.enabled !== false,
        maxEntries: Number.isInteger(raw.maxEntries) ? Math.min(200, Math.max(1, raw.maxEntries)) : 50,
        requireEmptyDraft: raw.requireEmptyDraft !== false,
      };
    }

    /** Flatten a message's content blocks into plain text. */
    function textOfContent(content) {
      if (typeof content === 'string') return content;
      if (!Array.isArray(content)) return '';
      const parts = [];
      for (const block of content) {
        if (typeof block === 'string') parts.push(block);
        else if (block !== null && typeof block === 'object' && typeof block.text === 'string') parts.push(block.text);
      }
      return parts.join('');
    }

    /** Plain text of one Chat node, or `''` when it is not a human message. */
    function textOfNode(node) {
      if (node === null || typeof node !== 'object' || node.kind !== 'user') return '';
      const payload = node.data ?? node.state;
      if (payload === null || typeof payload !== 'object') return '';
      return textOfContent(payload.content ?? payload.text).trim();
    }

    /** Every visible menu that owns arrow keys while it is open. */
    const MENU_SELECTOR = '[role="menu"],[role="listbox"],[aria-haspopup="menu"][aria-expanded="true"]';

    /** Put the caret at the end of the focused editor, best effort. */
    function caretToEnd() {
      try {
        const editor = document.querySelector('[contenteditable="true"]:focus');
        const selection = window.getSelection();
        if (editor === null || selection === null) return;
        selection.selectAllChildren(editor);
        selection.collapseToEnd();
      } catch {
        /* selection APIs differ per browser; the editor keeps its own caret */
      }
    }

    /**
     * Where the caret sits inside the editor. A multi-line draft keeps its own
     * arrow keys until the caret reaches the first (↑) or last (↓) visual line,
     * so recalling never steals intra-text cursor movement.
     * @param editor - the focused contenteditable.
     * @returns whether the selection is collapsed and which edges it touches.
     */
    function caretPlacement(editor) {
      const selection = window.getSelection?.();
      if (selection === null || selection === undefined || selection.rangeCount === 0) {
        return { collapsed: false, first: false, last: false };
      }
      const range = selection.getRangeAt(0);
      if (!range.collapsed) return { collapsed: false, first: false, last: false };
      const multiline = /\n/.test(editor.innerText ?? '');
      if (!multiline) return { collapsed: true, first: true, last: true };
      const lineHeight = Number.parseFloat(window.getComputedStyle(editor).lineHeight) || 20;
      /** Measure the sliver of content between the edge and the caret. */
      const measure = (fromStart) => {
        try {
          const probe = document.createRange();
          probe.selectNodeContents(editor);
          if (fromStart) probe.setEnd(range.startContainer, range.startOffset);
          else probe.setStart(range.endContainer, range.endOffset);
          return probe.getBoundingClientRect().height <= lineHeight * 1.6;
        } catch {
          return false;
        }
      };
      return { collapsed: true, first: measure(true), last: measure(false) };
    }

    /**
     * Invisible bridge: it mounts inside the composer's dock, subscribes to the
     * Chat snapshot for the sent-message ring, and owns the ↑/↓/Esc handler.
     * @param props - session-standard Chat hook plus the composer's input actions.
     * @returns a hidden marker element.
     */
    function Bridge(props) {
      const config = readConfig();
      const useChat = props.useChat;
      const inputActions = props.inputActions;

      // A string selector keeps the store subscription stable: the joined text
      // only changes when a human message is added or history is trimmed.
      const joined = (typeof useChat === 'function'
        ? useChat((snapshot) => {
          if (snapshot === undefined || snapshot === null || snapshot.nodes === undefined) return '';
          const texts = [];
          for (const node of snapshot.nodes.values()) {
            const text = textOfNode(node);
            if (text !== '') texts.push(text);
          }
          return texts.slice(-config.maxEntries).join('\u0000');
        })
        : undefined) ?? '';

      const historyRef = React.useRef([]);
      historyRef.current = joined === '' ? [] : joined.split('\u0000');

      const stateRef = React.useRef({ index: null, inserted: '', saved: '' });

      React.useEffect(() => {
        if (!config.enabled || typeof inputActions?.setDraft !== 'function') return undefined;

        const setDraft = (text) => {
          try {
            inputActions.setDraft(text);
          } catch {
            /* a locked or submitting composer refuses drafts; leave it alone */
          }
        };

        const onKeyDown = (event) => {
          if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
          const key = event.key;
          if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'Escape') return;
          const editor = document.activeElement;
          if (!(editor instanceof HTMLElement) || !editor.isContentEditable) return;
          if (key !== 'Escape' && document.querySelector(MENU_SELECTOR) !== null) return;

          const state = stateRef.current;
          const history = historyRef.current;
          const text = editor.innerText ?? '';

          if (key === 'Escape') {
            state.index = null;
            return;
          }

          const placement = caretPlacement(editor);
          if (!placement.collapsed) return;

          const browsing = state.index !== null;
          if (!browsing) {
            if (key !== 'ArrowUp' || !placement.first || history.length === 0) return;
            if (config.requireEmptyDraft && text.trim() !== '') return;
            event.preventDefault();
            state.saved = text;
            state.index = history.length - 1;
            state.inserted = history[state.index];
            setDraft(state.inserted);
            window.setTimeout(caretToEnd, 0);
            return;
          }

          if (key === 'ArrowUp') {
            // Only on the first visual line: inside a multi-line draft the caret keeps ↑.
            if (!placement.first || state.index === 0) return;
            event.preventDefault();
            state.index -= 1;
            state.inserted = history[state.index];
            setDraft(state.inserted);
            window.setTimeout(caretToEnd, 0);
            return;
          }

          // ArrowDown walks forward on the last visual line and finally restores the draft.
          if (!placement.last) return;
          event.preventDefault();
          if (state.index >= history.length - 1) {
            const restore = state.saved;
            state.index = null;
            state.inserted = '';
            setDraft(restore);
            window.setTimeout(caretToEnd, 0);
            return;
          }
          state.index += 1;
          state.inserted = history[state.index];
          setDraft(state.inserted);
          window.setTimeout(caretToEnd, 0);
        };

        const onReset = () => {
          stateRef.current.index = null;
          stateRef.current.inserted = '';
        };

        // Capture phase: the editor's own key handling must not see the arrow
        // first, otherwise the caret moves before the recall lands.
        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('submit', onReset, true);
        window.addEventListener('blur', onReset);
        return () => {
          document.removeEventListener('keydown', onKeyDown, true);
          document.removeEventListener('submit', onReset, true);
          window.removeEventListener('blur', onReset);
        };
      }, [config.enabled, config.requireEmptyDraft, inputActions]);

      return h('span', {
        [MARKER]: '',
        hidden: true,
        'aria-hidden': true,
        style: { display: 'none' },
      });
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'composer-history: copy');
        // Collapse the dock entry's wrapper: this marker is invisible, and the
        // dock is a flex column whose gaps would otherwise leave a blank strip.
        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = 'dsh-composer-history';
          tag.textContent = `[data-slot="conversation.composer.dock"] > :has(> [${MARKER}]){display:none}`;
          document.head.append(tag);
          return () => tag.remove();
        }, 'composer-history: hidden entry');
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'composer-history',
          order: 90,
          locale: NS,
        }, Bridge));
      },
    };
  },
});
