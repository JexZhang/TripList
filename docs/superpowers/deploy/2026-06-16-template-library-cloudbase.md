# 攻略库 CloudBase 部署清单

1. 建集合

1.1. 在云开发控制台「数据库」新建集合 trip_templates。

2. 安全规则

2.1. 集合 trip_templates 的权限设为「自定义安全规则」，内容：

```json
{
  "read": "auth != null",
  "write": false
}
```

2.2. 含义：登录用户可读（小程序调用方都已自动鉴权，等价于全员可读），客户端一律禁写；写入仅经控制台/CLI 管理员通道（导入不受安全规则约束）。

2.3. 注意：不要用「仅创建者可写」`"write": "doc._openid == auth.openid"`——那是用户自有数据（如 trips）的范式。攻略库是只读模板，套用该规则会允许任意客户端 add 新模板文档（插入时 doc._openid 即等于调用者 openid），污染公共库。故此处必须 `write: false`。

3. 部署云函数 clone-template

3.1. 在微信开发者工具 cloudfunctions/clone-template 右键「上传并部署：云端安装依赖」。

3.2. 确认 trips 集合写权限允许云函数写入（沿用 clone-trip 的现有配置）。

4. 导入初始数据

4.1. 在 trip_templates 集合「导入」docs/superpowers/deploy/trip-templates-seed.json。注意：微信云开发控制台要求文件扩展名为 .json，但内容必须是 JSON Lines 格式（每行一个独立 JSON 对象，不是数组、不缩进）。本文件已是该格式，直接选它即可，勿改成数组或重新格式化。

4.2. 冲突处理模式选「Insert」（新增），共导入 3 条文档。

4.3. 导入后抽查：至少 1 条 featured=true，dayCount 与 days 长度一致。

5. 联调验证

5.1. 小程序首页应出现「精选攻略」横滑区。

5.2. 进入模板 → 四 Tab 只读 → 复制选出发日 → 跳转到可编辑 trip，日期从所选出发日顺延。

5.3. 攻略库页天数 chip / 次级筛选 / 搜索均生效，无结果/无网络/loading 三态正常。
