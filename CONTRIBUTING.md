# Contributing / 贡献指南

Thanks for helping make this small tool easier to use. Please start with a focused issue describing the problem, expected result and a minimal reproduction.

欢迎帮助完善这个小工具。建议先提出范围清晰的问题，说明使用场景、预期结果和最小复现。

## Local development / 本地开发

Requires Node.js 22.12 or later. / 需要 Node.js 22.12 或以上。

```sh
npm ci
npm test
```

Use npm run dev for the visual demo; the editing endpoint is development-only. / 运行 npm run dev 体验可视化演示；编辑端点仅在开发模式启用。

## A useful change / 有用的改动

- Keep public APIs small and document changed behavior in both README versions.
- Include a focused regression case for a real bug or new contract.
- Prefer synthetic fixtures; do not add credentials, personal records, internal URLs or customer content.
- Keep generated output, local state and dependency directories out of commits.
- Describe what you tested, including any platform or application that was not checked.

- 保持接口简洁，同时更新中英文说明。
- 为实际缺陷或新增行为提供有针对性的验证。
- 优先使用合成样例，不加入密钥、个人记录、内部网址或客户内容。
- 不提交生成结果、本地状态和依赖目录。
- 说明实际验证范围，以及尚未检查的平台或应用。

## Licensing / 许可

Project code uses [MIT](LICENSE). Contributions must be compatible with that license. Third-party data, fonts and libraries retain their own terms.

项目代码使用 [MIT](LICENSE)。贡献须兼容该许可；第三方数据、字体和依赖继续遵循各自条款。
