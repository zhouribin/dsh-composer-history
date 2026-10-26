# 输入框历史 · dsh-composer-history

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的输入框加 **shell 式历史回填**：输入框空着的时候按 ↑，把上一条发过的消息拿回来改一改再发。

DSH 本身没有这个功能（输入框是 Lexical 编辑器，方向键只用来移光标），这个插件用 DSH 自己的 `inputActions.setDraft()` 写回输入框，不伪造按键、不直接改编辑器 DOM。

## 交互

| 按键 | 条件 | 行为 |
| --- | --- | --- |
| `↑` | 输入框为空、没有菜单打开 | 回填上一条消息 |
| `↑` | 正在浏览历史 | 再往上一条 |
| `↓` | 正在浏览历史 | 下一条；到底后恢复你原来没发出去的草稿 |
| `Esc` | 正在浏览历史 | 退出浏览，文本留在输入框里 |

不会被抢走的场景：输入框里有内容时、`/` 指令或模型菜单打开时、中文输入法组合中（`isComposing`）、`@` 文件补全打开时。

## 安装

**用 AI 装**：把下面这段丢给你正在用的 DSH。

```text
请把 dsh-composer-history 装到当前 DSH profile，只装不改配置：
git+https://github.com/zhouribin/dsh-composer-history.git#v1.0.0
用 plugin_manager 的 install_bundle，target 直接用上面这串；返回 already-installed 就跳过；
application=applied 才算成功；装完提醒我重启 App（客户端模块只在启动时加载）。
```

**手动装**：侧栏「插件」→ 添加插件 → 粘贴 `git+https://github.com/zhouribin/dsh-composer-history.git#v1.0.0` → 安装 → **重启一次 App**。

不需要 npm 账号，也不改 DSH 安装目录。

## 配置

`~/.dsh/profiles/<profile>/cordis.patch.yml`：

```yaml
- id: composer-history
  name: 'dsh-composer-history'
  config:
    enabled: true
    maxEntries: 50          # 记多少条（1–200）
    requireEmptyDraft: true # false = 输入框有内容时 ↑ 也会被历史覆盖（不建议）
```

改完刷新页面；不生效就重启 App。

## 边界（先说清楚）

- **历史来自当前会话的聊天记录**：你在这次会话里发过的消息，按顺序回填；换会话就是那一段的历史。没有做跨会话持久化，也没打算做——跨会话混在一起的"上一条"通常不是你想要的。
- **只在草稿为空时触发 ↑**：这是刻意的。否则你在多行草稿里想上移一行就会被历史顶掉。
- **不改终端、不改弹窗**：只对主输入框生效。
- **依赖 DSH 的插槽和输入 API**（`conversation.composer.dock`、`inputActions.setDraft`、Chat 快照的 `user` 节点）。官方某次更新改了名字，插件会静默失效，不影响 DSH 本体，卸载即恢复。

## 原理

- Host 端只做一件事：把 `enabled / maxEntries / requireEmptyDraft` 通过 `webserver/index-inject` 发给页面。
- 客户端注册一个**不可见**的组件到 `conversation.composer.dock`（插槽会隐藏它，不占布局），从 `useChat` 快照里取 `kind: 'user'` 的节点文本组成历史环，用捕获阶段的 `keydown` 接管 ↑/↓/Esc，再调 `inputActions.setDraft()` 写回。

## 授权

MIT，见 [LICENSE](LICENSE)。

## English

Shell-style history for the Harness composer: press `↑` on an empty composer to recall your previous message, `↑`/`↓` to walk the ring, `Esc` to leave, `↓` past the newest entry restores the draft you had. Arrow keys inside menus, slash commands, `@` completion and IME composition are left alone. Install with the Git spec above, restart the app once, and tune `maxEntries` / `requireEmptyDraft` in the profile patch.
