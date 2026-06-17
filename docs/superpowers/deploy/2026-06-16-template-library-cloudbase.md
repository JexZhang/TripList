# 攻略库 CloudBase 部署清单

1. 建集合

1.1. 在云开发控制台「数据库」新建集合 trip_templates。

2. 安全规则

2.1. 集合 trip_templates 的权限设为「自定义安全规则」，内容：

```json
{
  "read": true,
  "write": false
}
```

2.2. 含义：全员可读，客户端禁写；写入仅经控制台/CLI 管理员通道。

3. 部署云函数 clone-template

3.1. 在微信开发者工具 cloudfunctions/clone-template 右键「上传并部署：云端安装依赖」。

3.2. 确认 trips 集合写权限允许云函数写入（沿用 clone-trip 的现有配置）。

4. 导入初始数据

4.1. 在 trip_templates 集合「导入」docs/superpowers/deploy/trip-templates-seed.json。

4.2. 导入后抽查：至少 1 条 featured=true，dayCount 与 days 长度一致。

5. 联调验证

5.1. 小程序首页应出现「精选攻略」横滑区。

5.2. 进入模板 → 四 Tab 只读 → 复制选出发日 → 跳转到可编辑 trip，日期从所选出发日顺延。

5.3. 攻略库页天数 chip / 次级筛选 / 搜索均生效，无结果/无网络/loading 三态正常。
