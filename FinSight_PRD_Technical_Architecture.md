# 个人金融分析管理产品 PRD + 技术方案与架构设计文档

产品暂定名：**FinSight Personal Finance Dashboard**  
目标用户：加拿大个人用户、留学生、新移民、家庭财务管理者、个人投资者  
核心定位：**隐私优先的个人金融分析与资产管理 Dashboard**  
核心价值：整合分散在银行、信用卡、投资账户、房贷、订阅服务中的财务数据，帮助用户理解、预测和优化个人财务状况。

---

# Part 1：产品 PRD

## 1. 产品背景

个人用户的金融数据高度分散：

- 支票账户、储蓄账户在银行 App；
- 信用卡消费在不同信用卡平台；
- TFSA、RRSP、FHSA、Margin 等投资账户在 Wealthsimple、Questrade、IBKR 或银行投资平台；
- 房贷、车贷、LOC、保险、订阅等固定支出分布在不同机构；
- 投资持仓、成本、收益和汇率影响难以统一计算；
- 传统记账 App 侧重交易记录，缺少资产负债、投资估值、现金流预测和财务洞察。

用户希望有一个系统可以回答：

1. 我现在真实净资产是多少？
2. 本月我花了多少钱，月底大概会花多少？
3. 哪些支出是固定周期性支出？
4. 我的投资组合今天赚/亏多少？
5. 我的资产增长来自投资收益，还是只是因为我多存了钱？
6. 我的未来 3、6、12 个月现金流是否健康？
7. 我是否有信用卡还款、订阅膨胀、现金不足、投资过度集中等风险？

---

## 2. 产品目标

### 2.1 一句话目标

构建一个 **daily-updated personal finance intelligence dashboard**，通过 SimpleFIN 获取银行和信用卡数据，通过用户上传/手动输入补全投资持仓，通过行情数据源更新资产估值，最终为用户提供净资产、消费、订阅、投资收益和现金流预测。

### 2.2 产品目标拆解

| 目标 | 说明 |
|---|---|
| 聚合财务数据 | 聚合银行账户、信用卡、投资持仓、现金、负债 |
| 追踪净资产 | 计算 Assets - Liabilities，并展示趋势 |
| 分析消费 | 自动分类、商户聚合、月度分析、预算偏差 |
| 识别周期费用 | 自动识别订阅、保险、房租、贷款等周期性支出 |
| 估值投资组合 | 每日更新股票、ETF、黄金等市值变化 |
| 预测现金流 | 根据收入、支出、信用卡还款、订阅和投资计划预测未来余额 |
| 解释资产变化 | 拆解净资产变化来源：收入结余、消费、投资收益、债务变化、汇率变化 |
| 保护隐私 | 不直接保存银行密码，支持手动模式，数据最小化存储 |

---

## 3. 目标用户

### 3.1 用户 A：加拿大职场个人用户

特征：

- 年收入稳定；
- 有支票账户、储蓄账户、2-4 张信用卡；
- 每月有固定房租/房贷、保险、订阅、超市、交通支出；
- 想知道每月钱花在哪里，以及是否能稳定储蓄。

核心需求：

- 月度消费分析；
- 订阅识别；
- 信用卡还款提醒；
- 现金流预测；
- 净资产趋势。

### 3.2 用户 B：个人投资者

特征：

- 有 TFSA、RRSP、FHSA、Margin 账户；
- 持有美股、加拿大 ETF、A 股 ETF、黄金 ETF；
- 希望知道每日投资收益和净资产变化；
- 不希望把投资账户完整接入第三方平台。

核心需求：

- 手动添加/上传持仓；
- 每日估值；
- 投资组合收益；
- 资产配置；
- 多币种 CAD 折算；
- 价格收益和汇率收益拆解。

### 3.3 用户 C：隐私敏感用户

特征：

- 不愿意产品获取银行登录信息；
- 可以接受 SimpleFIN 这种授权式连接；
- 更倾向上传 statement 或手动录入；
- 关心数据是否可删除、是否被 AI 使用。

核心需求：

- Manual Mode；
- 数据来源透明；
- 文件上传后可删除；
- 不保存银行凭据；
- 本地/加密处理；
- 数据置信度显示。

---

## 4. 产品范围

### 4.1 MVP 范围

MVP 主要解决 5 个问题：

1. 用户能看到总资产和总负债；
2. 用户能看到本月消费分析；
3. 用户能看到订阅和周期费用；
4. 用户能手动添加投资持仓并每日估值；
5. 用户能看到未来现金流预测。

### 4.2 MVP 数据来源

| 数据来源 | 用途 | MVP 是否支持 |
|---|---|---|
| SimpleFIN Bridge | 银行账户、信用卡余额和交易 | 支持 |
| 手动添加持仓 | 投资组合估值 | 支持 |
| Statement 上传 | 投资持仓补全 | P1 支持 |
| 截图上传 | 持仓 OCR 识别 | P1 支持 |
| yfinance | 美股、加股、ETF、黄金 ETF、外汇 | 支持 |
| AkShare | A 股、A 股 ETF | P1 支持 |
| 手动添加负债 | 房贷、LOC、车贷 | 支持基础版 |
| CSV 导入 | 银行/信用卡交易补全 | P1 支持 |

---

## 5. 核心功能模块

## 5.1 用户账户与 Onboarding

### 功能说明

用户首次进入产品时，需要完成财务数据初始化。

### Onboarding 流程

#### Step 1：选择使用模式

用户选择：

1. **Manual Mode**
   - 不连接银行；
   - 手动添加账户；
   - 上传 statement；
   - 手动添加投资持仓。

2. **Connected Mode**
   - 使用 SimpleFIN 连接银行/信用卡；
   - 每日自动同步；
   - 投资仍由用户手动/上传补全。

推荐文案：

> 你可以完全不连接银行账户，仅通过手动录入和账单上传使用本产品。连接 SimpleFIN 后，可自动同步银行和信用卡余额及交易记录。

#### Step 2：设置基础信息

| 字段 | 说明 |
|---|---|
| Base Currency | 默认 CAD |
| Country | 默认 Canada |
| Timezone | 默认 America/Toronto |
| Monthly Income | 可选 |
| Pay Frequency | weekly / bi-weekly / semi-monthly / monthly |
| Financial Goal | emergency fund / down payment / debt payoff / investment growth |

#### Step 3：连接银行账户

如果用户选择 Connected Mode：

- 跳转 SimpleFIN 授权流程；
- 用户选择银行和账户；
- 系统拉取账户列表、余额、交易；
- 用户确认哪些账户纳入 Dashboard。

#### Step 4：添加投资持仓

方式：

1. 手动添加；
2. 上传 statement；
3. 上传截图；
4. 稍后添加。

MVP 优先支持手动添加。

#### Step 5：设置预算与目标

| 字段 | 示例 |
|---|---|
| Monthly spending target | 3000 CAD |
| Monthly saving target | 1500 CAD |
| Emergency fund target | 15000 CAD |
| Down payment target | 100000 CAD |
| Investment contribution target | 1000 CAD/month |

### 验收标准

- 用户可以跳过银行连接，只用手动模式；
- 用户可以连接 SimpleFIN 并选择账户；
- 用户可以设置 CAD 为默认展示币种；
- 用户可以手动添加至少一个投资持仓；
- 用户完成 onboarding 后进入 Dashboard。

---

## 5.2 总资产与净资产 Dashboard

### 功能说明

展示用户当前财务总览。

核心公式：

```text
Net Worth = Total Assets - Total Liabilities
```

### 资产分类

| 类型 | 示例 |
|---|---|
| Cash | 支票账户、储蓄账户、现金 |
| Investment | TFSA、RRSP、FHSA、Margin |
| Real Estate | 房产估值，P2 |
| Other Assets | 手动添加资产 |
| Gold / Commodity | 黄金 ETF 或实物黄金 |
| Crypto | P2 可选 |

### 负债分类

| 类型 | 示例 |
|---|---|
| Credit Card Balance | Amex、Rogers、CIBC Visa |
| Mortgage | 房贷余额 |
| Line of Credit | 信用额度贷款 |
| Auto Loan | 车贷 |
| Student Loan | 学贷 |
| Other Loan | 其他负债 |

### 首页核心卡片

#### Card 1：Net Worth

展示：

- 当前净资产；
- 较昨日变化；
- 较上月变化；
- 变化百分比；
- 数据更新时间。

示例：

```text
Net Worth
$86,420 CAD
+$320 today
+$2,140 this month
Last updated: Jun 1, 2026
```

#### Card 2：Assets

展示：

- Cash；
- Investments；
- Other assets；
- Asset allocation chart。

#### Card 3：Liabilities

展示：

- Credit card balance；
- Mortgage；
- LOC；
- Debt-to-asset ratio。

#### Card 4：Monthly Spending

展示：

- 本月已消费；
- 月底预测消费；
- 与预算对比；
- 与上月对比。

#### Card 5：Investment Portfolio

展示：

- 当前投资市值；
- 今日盈亏；
- 总未实现收益；
- 资产配置。

#### Card 6：Recurring Costs

展示：

- 月度周期费用；
- 年化周期费用；
- 新发现订阅；
- 即将扣款项目。

### 净资产变化拆解

必须支持 Waterfall 结构。

示例：

```text
上月净资产：$82,000
+ 工资结余：$2,300
+ 投资收益：$850
+ 汇率收益：$120
- 消费超支：$430
- 信用卡新增负债：$300
= 当前净资产：$84,540
```

### 验收标准

- 系统能够计算总资产、总负债、净资产；
- 所有资产统一折算为 CAD；
- 可以展示净资产历史趋势；
- 可以展示资产和负债分类；
- 可以解释净资产变化来源。

---

## 5.3 银行和信用卡数据同步

### 功能说明

通过 SimpleFIN 获取支票、储蓄、信用卡账户数据。

### 支持数据

| 数据 | 说明 |
|---|---|
| Account balance | 当前账户余额 |
| Available balance | 可用余额，如有 |
| Transactions | 交易流水 |
| Institution name | 银行/信用卡机构 |
| Account type | checking/savings/credit_card |
| Currency | CAD/USD |
| Pending transactions | 如果 SimpleFIN 返回，则支持 |

### 同步策略

| 场景 | 策略 |
|---|---|
| 首次连接 | 拉取可用历史交易 |
| 日常同步 | 每日一次 |
| 用户手动刷新 | 允许每日有限次数 |
| 同步失败 | 重试 1-2 次 |
| 长期失败 | 标记 Connection Health |
| 账户断开 | 保留历史数据，停止更新 |

### Connection Health

| 状态 | 说明 |
|---|---|
| Healthy | 正常同步 |
| Delayed | 最近一次同步延迟 |
| Failed | 同步失败 |
| Requires Action | 需要用户重新授权 |
| Unsupported | 机构或账户类型不支持 |

### 验收标准

- 用户连接 SimpleFIN 后可以看到账户列表；
- 系统每天同步余额和交易；
- 同步失败时有明确提示；
- 用户可以断开账户连接；
- 断开后停止新数据同步，但保留历史数据除非用户删除。

---

## 5.4 交易清洗、分类与商户标准化

### 功能说明

将银行/信用卡交易转化为可分析的消费数据。

### 交易处理流程

```text
Raw Transaction
→ Deduplication
→ Merchant Normalization
→ Transfer Detection
→ Category Classification
→ Recurring Detection
→ User Review
→ Analytics Layer
```

### 商户标准化

| 原始描述 | 标准商户 |
|---|---|
| WAL-MART #3155 TORONTO | Walmart |
| WALMART.CA | Walmart |
| COSTCO WHOLESALE 123 | Costco |
| AMZN Mktp CA | Amazon |
| UBER TRIP | Uber |

### 分类体系

一级分类：

- Income
- Housing
- Grocery
- Dining
- Transportation
- Utilities
- Insurance
- Healthcare
- Shopping
- Entertainment
- Subscription
- Travel
- Education
- Debt Payment
- Investment Transfer
- Tax
- Transfer
- Other

### 分类方法

MVP 建议采用混合方法：

1. 规则匹配；
2. 商户字典；
3. fuzzy matching；
4. 用户修正；
5. 后续引入 ML/LLM 分类。

### 用户修正机制

用户可以修改：

- merchant；
- category；
- subcategory；
- 是否为订阅；
- 是否为转账；
- 是否排除在消费统计外。

系统应学习用户修正规则。

### 验收标准

- 系统能识别常见商户；
- 系统能自动分类交易；
- 用户可以手动修改分类；
- 用户修正后，后续同类交易自动应用；
- 信用卡还款、账户间转账、投资转入不计入消费。

---

## 5.5 转账与信用卡还款识别

### 功能说明

防止把账户间转账、信用卡还款、投资转入误判为消费。

### 需要识别的类型

| 类型 | 处理方式 |
|---|---|
| Credit Card Payment | 不计入消费，减少负债 |
| Internal Transfer | 不计入收入/支出 |
| Investment Contribution | 不计入消费，算资产转移 |
| Refund | 抵扣原消费 |
| Loan Payment | 拆分本金和利息，MVP 可先整体记为 debt payment |
| Payroll Deposit | 计入收入 |

### 匹配规则

金额匹配：

```text
amount_out ≈ amount_in
```

日期匹配：

```text
交易日期相差 0-3 天
```

关键词：

```text
payment
transfer
visa
mastercard
amex
wealthsimple
questrade
rrsp
tfsa
fhsa
e-transfer
bill payment
```

### 验收标准

- 信用卡还款不计入消费；
- 账户间转账不计入收入或支出；
- 投资账户转入不计入消费；
- 用户可以手动确认/取消匹配；
- 系统记录 transfer link。

---

## 5.6 月度消费分析

### 功能说明

帮助用户理解每月钱花在哪里。

### 核心指标

| 指标 | 说明 |
|---|---|
| Total Spending | 本月总消费 |
| Spending by Category | 分类消费 |
| Spending by Merchant | 商户消费 |
| Fixed Cost | 固定支出 |
| Variable Cost | 可变支出 |
| Recurring Cost | 周期费用 |
| Discretionary Spending | 可选消费 |
| Month-over-month Change | 环比变化 |
| Budget Usage | 预算使用率 |
| Forecast Month-end Spending | 月底预测消费 |

### 月度报告结构

#### Section 1：本月概览

```text
本月已消费：$2,480
预计月底消费：$3,320
较上月：+8%
预算使用率：82%
```

#### Section 2：分类支出

| 分类 | 金额 | 占比 | 较上月 |
|---|---:|---:|---:|
| Grocery | $620 | 25% | +12% |
| Dining | $410 | 16% | +22% |
| Transportation | $280 | 11% | -5% |
| Subscription | $95 | 4% | +3% |

#### Section 3：商户排行

| 商户 | 次数 | 金额 |
|---|---:|---:|
| Walmart | 5 | $320 |
| Costco | 2 | $260 |
| Uber | 8 | $145 |
| Amazon | 6 | $220 |

#### Section 4：异常消费

识别逻辑：

- 单笔金额高于过去均值；
- 某分类本月显著高于过去 3 个月；
- 新商户大额消费；
- 同一商户消费频次异常上升。

### 验收标准

- 生成月度消费总额；
- 按分类和商户聚合；
- 识别异常支出；
- 生成月底消费预测；
- 能排除转账、信用卡还款和投资转入。

---

## 5.7 订阅和周期费用分析

### 功能说明

自动识别重复出现的订阅、保险、水电费、贷款、会员费等周期性费用。

### 识别维度

| 维度 | 说明 |
|---|---|
| merchant 相似 | Netflix, Spotify, iCloud |
| 金额相似 | $20.99 ± 5% |
| 周期相似 | 每 30 天 |
| 分类相似 | subscription / utilities |
| 出现次数 | 至少 2-3 次 |
| 描述关键词 | subscription, membership, monthly, annual |

### 周期类型

| 类型 | 规则 |
|---|---|
| Weekly | 6-8 天 |
| Bi-weekly | 13-16 天 |
| Monthly | 25-35 天 |
| Quarterly | 80-100 天 |
| Annual | 330-395 天 |
| Irregular Recurring | 重复但周期不稳定 |

### 输出字段

| 字段 | 说明 |
|---|---|
| merchant | 商户 |
| amount | 金额 |
| frequency | 周期 |
| annualized_cost | 年化成本 |
| last_charge_date | 最近扣款日期 |
| next_expected_date | 下次预计扣款 |
| confidence | 置信度 |
| category | 类型 |
| user_status | active / ignored / cancelled |

### 验收标准

- 自动识别月度订阅；
- 自动计算年化成本；
- 预测下次扣款日期；
- 用户可以确认、忽略或标记为已取消；
- 订阅金额变化时提醒用户。

---

## 5.8 投资持仓管理

### 功能说明

用户可以手动添加或上传投资持仓，系统根据行情每日估值。

### 支持资产类型

| 类型 | MVP |
|---|---|
| US Stocks | 支持 |
| US ETFs | 支持 |
| Canadian Stocks | 支持 |
| Canadian ETFs | 支持 |
| Gold ETFs | 支持 |
| A-share Stocks | P1 |
| A-share ETFs | P1 |
| Mutual Funds | P2 |
| Crypto | P2 |
| Bonds | P2 |
| Cash | 支持 |

### 手动添加持仓字段

| 字段 | 必填 | 示例 |
|---|---|---|
| Account | 是 | TFSA |
| Ticker | 是 | VFV.TO |
| Asset Name | 否 | Vanguard S&P 500 ETF |
| Market | 是 | Canada |
| Asset Type | 是 | ETF |
| Quantity | 是 | 100 |
| Average Cost | 是 | 120 |
| Cost Currency | 是 | CAD |
| Purchase Date | 否 | 2025-01-01 |
| Fee | 否 | 9.99 |
| Note | 否 | Long-term holding |

### 账户类型

| 类型 | 说明 |
|---|---|
| TFSA | 免税账户 |
| RRSP | 延税退休账户 |
| FHSA | 首套房账户 |
| Margin | 应税投资账户 |
| Cash | 现金账户 |
| Other | 其他 |

### Statement 上传

P1 支持。

解析内容：

- account type；
- holding ticker；
- quantity；
- book cost；
- market value；
- cash balance；
- dividend；
- transactions。

必须经过用户确认后写入数据库。

### 截图上传

P1 支持。

流程：

```text
用户上传截图
→ OCR 识别
→ LLM 结构化字段
→ ticker 匹配
→ 用户确认
→ 写入 holdings
```

不得自动无确认写入。

### 验收标准

- 用户可以手动添加、编辑、删除持仓；
- 系统能按账户展示持仓；
- 系统能识别 ticker 对应市场；
- 系统能每日更新市值；
- 上传/截图识别结果必须由用户确认。

---

## 5.9 Market Data 行情模块

### 功能说明

为投资估值提供每日价格、汇率和 benchmark 数据。

### 数据源

| 数据 | 数据源 |
|---|---|
| 美股 | yfinance |
| 美股 ETF | yfinance |
| 加拿大股票 | yfinance |
| 加拿大 ETF | yfinance |
| 黄金 ETF | yfinance |
| USD/CAD | yfinance |
| CNY/CAD | yfinance 或其他 FX source |
| A 股 | AkShare |
| A 股 ETF | AkShare |
| 指数 benchmark | yfinance / AkShare |

### 更新频率

| 数据 | 频率 |
|---|---|
| 股票/ETF 收盘价 | 每日一次 |
| FX | 每日一次 |
| 历史价格 | 首次添加时回填 |
| Benchmark | 每日一次 |
| 手动刷新 | 可选 |

### 价格处理

优先使用：

```text
adjusted close
```

原因：

- 更适合长期收益计算；
- 处理分红、拆股等情况。

### 验收标准

- 能获取并缓存每日价格；
- 同一 ticker 不重复请求；
- 价格失败时保留上一日价格并标记 stale；
- 用户看到估值数据更新时间；
- 系统支持多币种价格折算。

---

## 5.10 Valuation Engine 投资估值引擎

### 功能说明

根据持仓、价格、汇率计算每日估值、收益和资产配置。

### 核心计算

当前市值：

```text
Market Value Local = Quantity × Latest Price
```

CAD 折算市值：

```text
Market Value CAD = Market Value Local × FX Rate to CAD
```

成本：

```text
Cost Basis CAD = Quantity × Average Cost × Cost Currency FX to CAD
```

未实现收益：

```text
Unrealized Gain CAD = Market Value CAD - Cost Basis CAD
```

未实现收益率：

```text
Unrealized Gain % = Unrealized Gain CAD / Cost Basis CAD
```

当日盈亏：

```text
Daily P&L CAD =
Quantity × (Today Price - Previous Close Price) × FX Rate
```

### 投资收益拆解

| 类型 | 说明 |
|---|---|
| Price Return | 标的价格变化 |
| FX Return | 汇率变化 |
| Dividend Return | 分红 |
| Contribution | 用户新增投入 |
| Withdrawal | 用户取出资金 |

### 净资产变化拆解

```text
Net Worth Change =
Cashflow Savings
+ Investment Market Return
+ FX Impact
+ Debt Principal Change
- Spending
+ Other Adjustments
```

### 估值置信度

| 情况 | 置信度 |
|---|---|
| 用户确认持仓 + 最新行情 | High |
| 用户手动持仓 + stale price | Medium |
| OCR 未确认 | Low |
| 无成本价 | Medium/Low |
| 缺少 FX | Medium/Low |

### 验收标准

- 系统能计算每个持仓市值；
- 系统能计算账户级投资市值；
- 系统能计算总投资市值；
- 系统能计算今日盈亏；
- 系统能计算总未实现收益；
- 系统能折算为 CAD；
- 系统能标记估值置信度。

---

## 5.11 现金流预测

### 功能说明

预测未来现金余额、信用卡还款压力和月末结余。

### 输入

| 输入 | 来源 |
|---|---|
| 当前现金余额 | SimpleFIN |
| 当前信用卡余额 | SimpleFIN |
| 历史收入 | 交易识别 |
| 历史消费 | 交易分类 |
| 固定支出 | recurring engine |
| 订阅费用 | recurring engine |
| 贷款/房租 | recurring engine / manual |
| 投资转入计划 | manual |
| 预算 | user setting |

### 预测公式

```text
Projected Cash Balance =
Current Cash
+ Expected Income
- Scheduled Bills
- Recurring Subscriptions
- Expected Variable Spending
- Credit Card Payments
- Planned Investment Contributions
```

### 输出

| 指标 | 说明 |
|---|---|
| Projected Month-end Cash | 月末现金预测 |
| Projected Spending | 月底消费预测 |
| Expected Income | 预计收入 |
| Upcoming Bills | 即将扣款 |
| Credit Card Payoff Need | 信用卡还款需求 |
| Savings Forecast | 预计结余 |
| Cash Shortfall Risk | 现金不足风险 |
| Emergency Fund Runway | 备用金可覆盖月数 |

### 预测方法

MVP 使用规则 + 统计模型：

```text
类别预测 = 最近 3 个月加权平均
```

权重示例：

| 月份 | 权重 |
|---|---:|
| 当前月趋势 | 50% |
| 上月 | 25% |
| 前两月 | 15% |
| 前三月 | 10% |

### 验收标准

- 能预测本月月底支出；
- 能预测月底现金余额；
- 能识别即将发生的周期扣款；
- 能提示现金不足风险；
- 用户可以手动调整预测假设。

---

## 5.12 净资产预测

### 功能说明

基于现金流、投资收益假设、债务变化预测未来净资产。

### 预测周期

| 周期 | MVP |
|---|---|
| 1 month | 支持 |
| 3 months | 支持 |
| 6 months | 支持 |
| 12 months | 支持 |
| 5 years | P2 |
| 10 years | P2 |

### 情景模型

| 情景 | 假设 |
|---|---|
| Conservative | 投资年化 2%，支出上升 5% |
| Base | 投资年化 5%，支出稳定 |
| Optimistic | 投资年化 8%，储蓄率提升 |

### 验收标准

- 能生成 3/6/12 个月净资产预测；
- 能展示 conservative/base/optimistic 三种情景；
- 用户可以修改假设；
- 明确标注预测不是财务建议。

---

## 5.13 AI 财务总结

### 功能说明

将结构化数据转为自然语言洞察。

### 月度总结示例

```text
本月总支出预计为 $3,420，比上月高 12%。主要增长来自餐饮和交通，其中 Uber 支出比过去三个月均值高 $86。周期性费用年化成本为 $5,832，其中软件和流媒体订阅占 $1,108。投资组合本月上涨 $820，其中 $610 来自美股 ETF，$140 来自汇率收益。
```

### AI 输出边界

必须遵守：

- 不提供个性化投资买卖建议；
- 不直接建议买入/卖出股票；
- 不提供确定性收益预测；
- 税务建议必须提示咨询专业人士；
- 原始金融数据进入模型前尽量脱敏。

### 验收标准

- 生成月度自然语言报告；
- 报告引用具体数据；
- 能解释数据来源；
- 不输出高风险投资建议。

---

## 6. 非功能需求

### 6.1 安全

| 要求 | 说明 |
|---|---|
| 不保存银行密码 | SimpleFIN token-based access |
| Token 加密 | 使用 KMS/Secrets Manager |
| 数据加密 | at-rest 和 in-transit |
| PII 分离 | 账户信息和交易信息分表 |
| 权限隔离 | 用户只能访问自己的数据 |
| 删除权 | 用户可删除所有数据 |
| 审计日志 | 记录同步、访问、删除动作 |

### 6.2 隐私

| 要求 | 说明 |
|---|---|
| Manual Mode | 不连接银行也可使用 |
| Data Minimization | 只保存必要字段 |
| AI 脱敏 | 原始交易尽量不直接送 LLM |
| Source Transparency | 每个数据点显示来源 |
| User Correction | 用户可以修正分类和估值 |
| Export | 用户可导出数据 |
| Delete | 用户可永久删除账户数据 |

### 6.3 性能

| 场景 | 要求 |
|---|---|
| Dashboard 首屏加载 | < 2 秒，缓存后 |
| 交易列表加载 | < 2 秒 |
| 每日同步任务 | 异步执行 |
| 价格更新 | 批量请求 |
| 估值计算 | 每日批处理 + 用户手动触发 |
| 文件解析 | 异步执行 |

---

## 7. 产品优先级

### P0：MVP 必须有

| 功能 | 优先级 |
|---|---|
| 用户注册登录 | P0 |
| Manual Mode | P0 |
| SimpleFIN 连接 | P0 |
| 账户余额同步 | P0 |
| 交易同步 | P0 |
| 交易分类 | P0 |
| 转账/信用卡还款识别 | P0 |
| 月度消费分析 | P0 |
| 订阅识别 | P0 |
| 手动添加投资持仓 | P0 |
| yfinance 行情 | P0 |
| CAD 折算 | P0 |
| Valuation Engine | P0 |
| Net Worth Dashboard | P0 |
| 基础现金流预测 | P0 |

### P1：增强版

| 功能 | 优先级 |
|---|---|
| Statement 上传解析 | P1 |
| 截图 OCR 持仓识别 | P1 |
| AkShare A 股/A 股 ETF | P1 |
| 多情景净资产预测 | P1 |
| 投资收益拆解 | P1 |
| Benchmark 对比 | P1 |
| AI 月度财务报告 | P1 |
| 订阅优化建议 | P1 |
| 异常消费提醒 | P1 |

### P2：长期功能

| 功能 | 优先级 |
|---|---|
| 房贷分析 | P2 |
| RRSP/FHSA/TFSA 税务规划 | P2 |
| Dividend tracking | P2 |
| Crypto | P2 |
| 家庭共享账户 | P2 |
| Mobile App | P2 |
| Open Banking 替代 SimpleFIN | P2 |
| Licensed market data provider | P2 |

---

# Part 2：技术方案与架构设计文档

## 1. 技术目标

系统需要支持：

1. 安全接入银行和信用卡数据；
2. 处理交易、分类、去重、转账匹配；
3. 管理投资持仓；
4. 每日获取市场价格；
5. 计算资产估值和收益；
6. 支持多币种折算；
7. 生成消费分析、订阅分析、现金流预测；
8. 为 Dashboard 提供低延迟查询；
9. 支持用户数据删除、审计和权限隔离。

---

## 2. 总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│                         Frontend                              │
│              Next.js Web App / Dashboard UI                   │
└──────────────────────────────▲───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                         API Layer                             │
│                 FastAPI / Django REST / GraphQL               │
└───────────────▲───────────────────────────────▲──────────────┘
                │                               │
                ▼                               ▼
┌──────────────────────────────┐   ┌───────────────────────────┐
│      User & Auth Service      │   │     Financial API Service  │
│ Auth / Permission / Settings  │   │ Accounts / Txns / Holdings │
└──────────────────────────────┘   └──────────────▲────────────┘
                                                   │
                                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                      Core Processing Layer                    │
│                                                              │
│ Transaction Engine │ Recurring Engine │ Transfer Matching      │
│ Valuation Engine   │ Forecast Engine  │ AI Insight Engine       │
└───────────────▲───────────────────────▲──────────────────────┘
                │                       │
                ▼                       ▼
┌──────────────────────────────┐   ┌───────────────────────────┐
│      External Data Layer      │   │       File Input Layer     │
│ SimpleFIN / yfinance / AK     │   │ PDF / CSV / Screenshot OCR │
└──────────────────────────────┘   └───────────────────────────┘
                │                       │
                ▼                       ▼
┌──────────────────────────────────────────────────────────────┐
│                         Data Layer                            │
│ PostgreSQL / TimescaleDB / Redis / Object Storage             │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 推荐技术栈

### 3.1 Frontend

| 模块 | 技术 |
|---|---|
| Web App | Next.js |
| UI | Tailwind CSS + shadcn/ui |
| Charts | Recharts / Apache ECharts |
| Table | TanStack Table |
| State | React Query + Zustand |
| Auth client | Clerk / Auth0 / Supabase Auth |
| File upload | S3 pre-signed URL |

### 3.2 Backend

| 模块 | 技术 |
|---|---|
| API | FastAPI |
| Language | Python |
| ORM | SQLAlchemy / SQLModel |
| DB | PostgreSQL |
| Time-series extension | TimescaleDB optional |
| Queue | Celery / RQ / Dramatiq |
| Scheduler | Celery Beat / Temporal / Prefect |
| Cache | Redis |
| Object Storage | S3 / Cloudflare R2 |
| Secrets | AWS KMS / GCP KMS / Doppler |
| Logging | OpenTelemetry + Grafana/Datadog |
| Deployment | Docker + Kubernetes / Render / Fly.io / AWS ECS |

### 3.3 Data Processing

| 功能 | 技术 |
|---|---|
| PDF parsing | pdfplumber / pymupdf |
| OCR | PaddleOCR / Tesseract / cloud OCR |
| Data validation | Pydantic |
| Market data | yfinance / AkShare adapters |
| FX data | yfinance / exchangerate provider |
| Merchant matching | rapidfuzz |
| ML classification | scikit-learn / lightGBM later |
| LLM extraction | structured JSON mode |
| Forecasting | statsmodels / custom rules |

---

## 4. 服务模块设计

## 4.1 Auth & User Service

### 职责

- 用户注册登录；
- 用户 settings；
- 权限控制；
- 数据删除；
- subscription plan，未来商业化用。

### 核心表：users

| 字段 | 类型 |
|---|---|
| id | uuid |
| email | text |
| name | text |
| base_currency | text |
| country | text |
| timezone | text |
| created_at | timestamp |
| deleted_at | timestamp |

### 核心表：user_settings

| 字段 | 类型 |
|---|---|
| user_id | uuid |
| monthly_budget | numeric |
| saving_target | numeric |
| risk_preference | text |
| ai_enabled | boolean |
| data_retention_policy | text |

---

## 4.2 SimpleFIN Connector Service

### 职责

- 管理 SimpleFIN 授权；
- 保存 access token；
- 拉取账户；
- 拉取交易；
- 标记同步状态；
- 处理同步失败。

### 同步流程

```text
User connects SimpleFIN
→ Backend receives setup token
→ Exchange token
→ Encrypt and store access credential
→ Fetch accounts
→ Fetch balances
→ Fetch historical transactions
→ Normalize data
→ Store raw + normalized records
→ Trigger transaction processing
```

### Daily Sync 流程

```text
Scheduler triggers sync job
→ Fetch connected accounts
→ For each account:
    → Pull latest balances
    → Pull transactions since last_synced_at
    → Store raw response
    → Normalize transactions
    → Deduplicate
    → Trigger classification
    → Update account balance
→ Update connection health
```

### external_raw_events

| 字段 | 说明 |
|---|---|
| provider | simplefin |
| user_id | 用户 |
| account_id | 账户 |
| raw_payload_encrypted | 加密原始数据 |
| fetched_at | 获取时间 |
| processing_status | pending / processed / failed |

---

## 4.3 Transaction Engine

### 职责

- 交易去重；
- 标准化；
- 商户识别；
- 分类；
- 转账识别；
- recurring 检测前处理。

### 交易处理 pipeline

```text
1. Ingest raw transaction
2. Generate transaction fingerprint
3. Deduplicate
4. Normalize amount and currency
5. Normalize merchant
6. Detect transfer/payment
7. Assign category
8. Apply user rules
9. Save processed transaction
10. Trigger analytics aggregation
```

### Deduplication Hash

```text
hash(
  provider,
  external_transaction_id,
  account_id,
  date,
  amount,
  description
)
```

如果 provider 没有稳定 transaction_id，则使用：

```text
hash(
  account_id,
  date,
  amount,
  normalized_description
)
```

### transactions 表

```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    account_id UUID NOT NULL,
    external_id TEXT,
    source TEXT NOT NULL,
    transaction_date DATE NOT NULL,
    posted_date DATE,
    amount NUMERIC(18, 4) NOT NULL,
    currency TEXT NOT NULL,
    merchant_raw TEXT,
    merchant_normalized TEXT,
    description_raw TEXT,
    category TEXT,
    subcategory TEXT,
    transaction_type TEXT,
    is_excluded_from_spending BOOLEAN DEFAULT FALSE,
    is_recurring BOOLEAN DEFAULT FALSE,
    confidence NUMERIC(5, 4),
    duplicate_hash TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

---

## 4.4 Merchant Normalization Service

### 职责

将交易描述映射为标准商户。

### 方法

```text
Rule dictionary
→ Keyword matching
→ Fuzzy matching
→ Embedding similarity, P1
→ LLM fallback, P1/P2
→ User correction rule
```

### merchant_rules 表

```sql
CREATE TABLE merchant_rules (
    id UUID PRIMARY KEY,
    user_id UUID,
    pattern TEXT NOT NULL,
    merchant_normalized TEXT NOT NULL,
    category TEXT,
    subcategory TEXT,
    priority INT DEFAULT 100,
    is_global BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP
);
```

---

## 4.5 Transfer Matching Engine

### 职责

识别非消费类资金流动。

### Rule 1：信用卡还款

```text
checking/savings account: negative transaction
credit card account: positive/payment transaction
amount close
date within 0-3 days
description contains card/payment
```

### Rule 2：账户间转账

```text
one account outflow
another account inflow
same user
amount close
date close
description contains transfer/e-transfer
```

### Rule 3：投资转入

```text
bank outflow
description contains Wealthsimple/Questrade/IBKR/TFSA/RRSP/FHSA
category = Investment Transfer
excluded_from_spending = true
```

### transfer_matches 表

```sql
CREATE TABLE transfer_matches (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    outflow_transaction_id UUID,
    inflow_transaction_id UUID,
    match_type TEXT,
    amount NUMERIC(18, 4),
    confidence NUMERIC(5, 4),
    status TEXT,
    created_at TIMESTAMP
);
```

状态：

```text
auto_confirmed
user_confirmed
rejected
needs_review
```

---

## 4.6 Recurring Detection Engine

### 职责

识别订阅和周期费用。

### 输入

- processed transactions；
- merchant_normalized；
- amount；
- date；
- category；
- user corrections。

### 算法

#### Step 1：按 merchant 分组

```text
group by user_id, merchant_normalized
```

#### Step 2：按金额聚类

允许浮动：

```text
amount tolerance = max(5%, $2)
```

#### Step 3：计算日期间隔

```text
intervals = date[i] - date[i-1]
```

#### Step 4：识别周期

```text
weekly: median interval 6-8
biweekly: median interval 13-16
monthly: median interval 25-35
annual: median interval 330-395
```

#### Step 5：计算置信度

| 因素 | 权重 |
|---|---:|
| 出现次数 | 30% |
| 周期稳定性 | 30% |
| 金额稳定性 | 20% |
| 商户类别 | 10% |
| 用户确认 | 10% |

### recurring_items 表

```sql
CREATE TABLE recurring_items (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    merchant_normalized TEXT NOT NULL,
    category TEXT,
    amount NUMERIC(18, 4),
    currency TEXT,
    frequency TEXT,
    annualized_cost NUMERIC(18, 4),
    last_charge_date DATE,
    next_expected_date DATE,
    confidence NUMERIC(5, 4),
    status TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

---

## 4.7 Holdings Service

### 职责

- 管理投资账户；
- 管理持仓；
- 接收手动输入、statement、截图识别；
- 校验 ticker；
- 生成 holdings 数据。

### investment_accounts 表

```sql
CREATE TABLE investment_accounts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT,
    institution TEXT,
    currency TEXT,
    source TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### holdings 表

```sql
CREATE TABLE holdings (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    investment_account_id UUID NOT NULL,
    ticker TEXT NOT NULL,
    asset_name TEXT,
    market TEXT,
    asset_type TEXT,
    quantity NUMERIC(24, 8) NOT NULL,
    avg_cost NUMERIC(18, 6),
    cost_currency TEXT,
    purchase_date DATE,
    source TEXT,
    verified_by_user BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 手动添加 API

```http
POST /api/holdings
```

请求：

```json
{
  "investment_account_id": "uuid",
  "ticker": "VFV.TO",
  "asset_type": "ETF",
  "market": "CA",
  "quantity": 100,
  "avg_cost": 120,
  "cost_currency": "CAD"
}
```

---

## 4.8 File Input & OCR Service

### 职责

处理 statement 和截图上传。

### 流程

```text
User uploads file
→ Store in object storage
→ Create file_processing_job
→ Extract text/table/OCR
→ Structure data into candidate holdings
→ User reviews candidates
→ Confirm and write to holdings
```

### file_uploads 表

```sql
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    file_name TEXT,
    file_type TEXT,
    storage_path TEXT,
    processing_status TEXT,
    detected_document_type TEXT,
    created_at TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### parsed_holding_candidates 表

```sql
CREATE TABLE parsed_holding_candidates (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    file_upload_id UUID NOT NULL,
    ticker TEXT,
    asset_name TEXT,
    quantity NUMERIC(24, 8),
    avg_cost NUMERIC(18, 6),
    market_value NUMERIC(18, 4),
    currency TEXT,
    confidence NUMERIC(5, 4),
    status TEXT,
    raw_text TEXT,
    created_at TIMESTAMP
);
```

### 用户确认机制

用户必须确认：

- ticker；
- quantity；
- avg_cost；
- currency；
- account type；
- 是否覆盖已有持仓。

---

## 4.9 Market Data Service

### 职责

- 获取行情；
- 缓存价格；
- 处理 FX；
- 处理 stale price；
- 为 Valuation Engine 提供价格数据。

### Adapter 设计

```text
MarketDataProvider
    ├── YFinanceProvider
    ├── AkShareProvider
    ├── FXProvider
    └── FutureLicensedProvider
```

### Provider Interface

```python
class MarketDataProvider:
    def get_latest_price(self, ticker: str, market: str) -> PriceQuote:
        pass

    def get_historical_prices(
        self,
        ticker: str,
        market: str,
        start_date: date,
        end_date: date
    ) -> list[PriceQuote]:
        pass
```

### prices 表

```sql
CREATE TABLE prices (
    id UUID PRIMARY KEY,
    ticker TEXT NOT NULL,
    market TEXT NOT NULL,
    price_date DATE NOT NULL,
    close_price NUMERIC(18, 6),
    adjusted_close NUMERIC(18, 6),
    currency TEXT NOT NULL,
    source TEXT NOT NULL,
    source_quality TEXT,
    fetched_at TIMESTAMP,
    UNIQUE(ticker, market, price_date, source)
);
```

### fx_rates 表

```sql
CREATE TABLE fx_rates (
    id UUID PRIMARY KEY,
    base_currency TEXT NOT NULL,
    quote_currency TEXT NOT NULL,
    rate_date DATE NOT NULL,
    rate NUMERIC(18, 8) NOT NULL,
    source TEXT,
    fetched_at TIMESTAMP,
    UNIQUE(base_currency, quote_currency, rate_date)
);
```

### Price Staleness

如果行情获取失败：

```text
use latest available price
mark price_status = stale
show warning in UI
```

---

## 4.10 Valuation Engine

### 职责

- 计算每日持仓估值；
- 计算账户估值；
- 计算总投资组合估值；
- 计算收益；
- 生成 valuation snapshots。

### 每日估值任务

```text
Scheduler daily after market close
→ Identify active holdings
→ Fetch missing prices
→ Fetch FX rates
→ Calculate holding valuations
→ Aggregate account valuations
→ Aggregate portfolio valuation
→ Write valuation snapshots
```

### holding_valuations 表

```sql
CREATE TABLE holding_valuations (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    holding_id UUID NOT NULL,
    valuation_date DATE NOT NULL,
    quantity NUMERIC(24, 8),
    price NUMERIC(18, 6),
    price_currency TEXT,
    fx_to_base NUMERIC(18, 8),
    market_value_local NUMERIC(18, 4),
    market_value_base NUMERIC(18, 4),
    cost_basis_base NUMERIC(18, 4),
    unrealized_gain_base NUMERIC(18, 4),
    unrealized_gain_pct NUMERIC(10, 6),
    daily_pnl_base NUMERIC(18, 4),
    daily_pnl_pct NUMERIC(10, 6),
    valuation_confidence TEXT,
    created_at TIMESTAMP,
    UNIQUE(user_id, holding_id, valuation_date)
);
```

### portfolio_snapshots 表

```sql
CREATE TABLE portfolio_snapshots (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    total_market_value_base NUMERIC(18, 4),
    total_cost_basis_base NUMERIC(18, 4),
    total_unrealized_gain_base NUMERIC(18, 4),
    daily_pnl_base NUMERIC(18, 4),
    cash_balance_base NUMERIC(18, 4),
    base_currency TEXT,
    created_at TIMESTAMP,
    UNIQUE(user_id, snapshot_date)
);
```

---

## 4.11 Net Worth Engine

### 职责

聚合所有账户、投资、负债，生成净资产快照。

### 输入

| 数据 | 来源 |
|---|---|
| Cash account balances | SimpleFIN |
| Credit card balances | SimpleFIN |
| Investment values | Valuation Engine |
| Manual liabilities | User input |
| Mortgage balance | Manual / statement |
| Other assets | Manual |

### net_worth_snapshots 表

```sql
CREATE TABLE net_worth_snapshots (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    total_assets_base NUMERIC(18, 4),
    total_liabilities_base NUMERIC(18, 4),
    net_worth_base NUMERIC(18, 4),
    cash_base NUMERIC(18, 4),
    investments_base NUMERIC(18, 4),
    credit_card_debt_base NUMERIC(18, 4),
    mortgage_debt_base NUMERIC(18, 4),
    other_debt_base NUMERIC(18, 4),
    base_currency TEXT,
    created_at TIMESTAMP,
    UNIQUE(user_id, snapshot_date)
);
```

### net_worth_attributions 表

```sql
CREATE TABLE net_worth_attributions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    period_start DATE,
    period_end DATE,
    income_contribution NUMERIC(18, 4),
    spending_impact NUMERIC(18, 4),
    investment_return NUMERIC(18, 4),
    fx_impact NUMERIC(18, 4),
    debt_change NUMERIC(18, 4),
    manual_adjustment NUMERIC(18, 4),
    total_change NUMERIC(18, 4),
    created_at TIMESTAMP
);
```

---

## 4.12 Analytics Aggregation Service

### 职责

提前计算 Dashboard 需要的聚合数据，降低查询延迟。

### monthly_spending_summary 表

```sql
CREATE TABLE monthly_spending_summary (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    month DATE NOT NULL,
    total_spending NUMERIC(18, 4),
    fixed_spending NUMERIC(18, 4),
    variable_spending NUMERIC(18, 4),
    recurring_spending NUMERIC(18, 4),
    income NUMERIC(18, 4),
    net_cashflow NUMERIC(18, 4),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(user_id, month)
);
```

### category_spending_summary 表

```sql
CREATE TABLE category_spending_summary (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    month DATE NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(18, 4),
    transaction_count INT,
    created_at TIMESTAMP,
    UNIQUE(user_id, month, category)
);
```

### merchant_spending_summary 表

```sql
CREATE TABLE merchant_spending_summary (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    month DATE NOT NULL,
    merchant_normalized TEXT NOT NULL,
    amount NUMERIC(18, 4),
    transaction_count INT,
    created_at TIMESTAMP,
    UNIQUE(user_id, month, merchant_normalized)
);
```

---

## 4.13 Forecast Engine

### 职责

预测现金流、消费、净资产。

### 现金流预测流程

```text
Get current cash balance
→ Estimate upcoming income
→ Get recurring items
→ Estimate variable spending
→ Estimate credit card payment
→ Apply planned contributions
→ Generate forecast by date
```

### cashflow_forecasts 表

```sql
CREATE TABLE cashflow_forecasts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    forecast_date DATE NOT NULL,
    forecast_horizon_days INT,
    projected_cash_balance NUMERIC(18, 4),
    projected_income NUMERIC(18, 4),
    projected_spending NUMERIC(18, 4),
    projected_recurring_cost NUMERIC(18, 4),
    projected_credit_card_payment NUMERIC(18, 4),
    risk_level TEXT,
    assumptions JSONB,
    created_at TIMESTAMP
);
```

### net_worth_forecasts 表

```sql
CREATE TABLE net_worth_forecasts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    forecast_date DATE NOT NULL,
    target_date DATE NOT NULL,
    scenario TEXT,
    projected_net_worth NUMERIC(18, 4),
    projected_assets NUMERIC(18, 4),
    projected_liabilities NUMERIC(18, 4),
    assumptions JSONB,
    created_at TIMESTAMP
);
```

---

## 4.14 AI Insight Service

### 职责

把结构化数据转化为用户可读的财务总结。

### 输入

只输入脱敏、聚合后的结构化数据：

```json
{
  "month": "2026-05",
  "total_spending": 3420,
  "top_categories": [
    {"category": "Grocery", "amount": 620},
    {"category": "Dining", "amount": 410}
  ],
  "recurring_cost_annualized": 5832,
  "investment_return_mtd": 820,
  "cashflow_forecast": 1200
}
```

### 不建议输入

- 原始银行卡号；
- 完整账户号；
- 未脱敏交易描述；
- 原始 PDF；
- 用户身份信息。

### 输出

- Monthly summary；
- Spending insight；
- Subscription insight；
- Investment insight；
- Cashflow risk；
- Action checklist。

---

## 5. API 设计

### 5.1 Account APIs

```http
GET /api/accounts
POST /api/accounts/manual
PATCH /api/accounts/{account_id}
DELETE /api/accounts/{account_id}
```

### 5.2 SimpleFIN APIs

```http
POST /api/integrations/simplefin/connect
GET /api/integrations/simplefin/status
POST /api/integrations/simplefin/sync
DELETE /api/integrations/simplefin/disconnect
```

### 5.3 Transaction APIs

```http
GET /api/transactions
PATCH /api/transactions/{transaction_id}
POST /api/transactions/{transaction_id}/categorize
POST /api/transactions/{transaction_id}/exclude
```

### 5.4 Analytics APIs

```http
GET /api/analytics/monthly-spending
GET /api/analytics/category-breakdown
GET /api/analytics/merchant-breakdown
GET /api/analytics/recurring
GET /api/analytics/cashflow-forecast
```

### 5.5 Holdings APIs

```http
GET /api/holdings
POST /api/holdings
PATCH /api/holdings/{holding_id}
DELETE /api/holdings/{holding_id}
```

### 5.6 Market Data APIs

```http
GET /api/market-data/price?ticker=VFV.TO
POST /api/market-data/refresh
GET /api/market-data/fx?base=USD&quote=CAD
```

### 5.7 Valuation APIs

```http
GET /api/valuations/portfolio
GET /api/valuations/holdings
GET /api/valuations/history
POST /api/valuations/recalculate
```

### 5.8 Net Worth APIs

```http
GET /api/net-worth/current
GET /api/net-worth/history
GET /api/net-worth/attribution
GET /api/net-worth/forecast
```

### 5.9 File Upload APIs

```http
POST /api/files/upload-url
POST /api/files/{file_id}/process
GET /api/files/{file_id}/candidates
POST /api/files/{file_id}/confirm
DELETE /api/files/{file_id}
```

---

## 6. 数据流设计

### 6.1 银行数据同步数据流

```text
SimpleFIN
→ Connector Service
→ Raw Event Store
→ Account Normalizer
→ Transaction Normalizer
→ Deduplication
→ Transaction Engine
→ Transfer Matching
→ Categorization
→ Analytics Aggregation
→ Dashboard
```

### 6.2 投资估值数据流

```text
User Holdings
→ Market Data Service
→ FX Service
→ Valuation Engine
→ Holding Valuations
→ Portfolio Snapshots
→ Net Worth Engine
→ Dashboard
```

### 6.3 文件上传数据流

```text
File Upload
→ Object Storage
→ OCR/PDF Parser
→ Candidate Extraction
→ User Review
→ Holdings Service
→ Valuation Engine
```

---

## 7. 定时任务设计

| 任务 | 频率 |
|---|---|
| SimpleFIN daily sync | 每日 |
| Market price update | 每日收盘后 |
| FX update | 每日 |
| Valuation calculation | 每日行情更新后 |
| Net worth snapshot | 每日 |
| Recurring detection | 每日或每周 |
| Monthly analytics aggregation | 每日增量 |
| Forecast refresh | 每日 |
| AI monthly report | 每月 1 日 |
| Stale data check | 每日 |

---

## 8. 安全架构

### 8.1 数据加密

| 数据 | 加密方式 |
|---|---|
| SimpleFIN token | KMS envelope encryption |
| Raw provider payload | AES-256 |
| Uploaded files | S3 encryption |
| PII | column-level encryption |
| Password/auth | 由 Auth provider 管理 |
| API traffic | HTTPS/TLS |

### 8.2 权限控制

所有查询必须带：

```text
user_id scope
```

禁止跨用户访问。

后端所有 SQL 查询必须按 user_id filter。

### 8.3 数据删除

用户删除账户时可选：

1. 删除连接，保留历史交易；
2. 删除连接和该账户所有数据；
3. 删除整个用户数据。

需要软删除 + 后台 hard delete job。

### 8.4 审计日志

记录：

- 登录；
- 连接 SimpleFIN；
- 同步数据；
- 上传文件；
- 删除数据；
- 导出数据；
- AI 分析调用。

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID,
    action TEXT,
    resource_type TEXT,
    resource_id UUID,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP
);
```

---

## 9. 隐私设计

### 9.1 数据最小化

原则：

```text
只存分析所需字段，不存无关敏感信息。
```

例如：

- 不存完整银行账号；
- 只存账户末四位；
- 不存银行登录密码；
- 原始文件可处理后删除；
- AI 使用聚合数据。

### 9.2 用户可见数据来源

每个指标都应显示：

```text
Source: SimpleFIN / Manual / Statement / yfinance / AkShare
Last updated: YYYY-MM-DD
Confidence: High / Medium / Low
```

### 9.3 AI 隐私模式

| 模式 | 说明 |
|---|---|
| AI Off | 不生成 AI 报告 |
| Aggregated Only | 只用聚合数据 |
| Detailed | 可使用分类后的交易数据 |
| Local-first future | 本地模型处理，P2 |

---

## 10. 错误处理与降级

### 10.1 SimpleFIN 同步失败

展示：

```text
CIBC Chequing 最近同步失败，当前余额为 2026-05-31 的数据。
```

系统行为：

- 保留旧数据；
- 标记 stale；
- 不阻塞 Dashboard；
- 提供重连入口。

### 10.2 行情失败

展示：

```text
VFV.TO 使用上一交易日价格估值。
```

系统行为：

- 使用 latest available price；
- valuation confidence 降级；
- 后台重试。

### 10.3 OCR 失败

展示：

```text
无法可靠识别该截图，请手动确认或重新上传更清晰图片。
```

---

## 11. Dashboard 页面架构

### 11.1 页面结构

```text
/dashboard
/accounts
/transactions
/spending
/recurring
/investments
/net-worth
/forecast
/settings
```

### 11.2 Dashboard 首页

模块：

1. Header Total Net Worth Summary：总资产价值、较昨日变化金额和百分比；
2. Goal Progress：用户自定义目标名和金额，例如 FIRE，并以进度条展示完成度；
3. Cash KPI；
4. Investments KPI；
5. Spending KPI；
6. Accounts KPI；
7. Recap KPI；
8. Risk KPI；
9. Forecast / Insight preview。

### 11.3 Investments 页面

模块：

1. Portfolio Value；
2. Daily P&L；
3. Holdings Table；
4. Allocation；
5. Account Breakdown；
6. Currency Exposure；
7. Performance History；
8. Add Holding。

### 11.4 Spending 页面

模块：

1. Spending Overview；
2. Category Breakdown；
3. Merchant Ranking；
4. Trend；
5. Budget Progress；
6. Unusual Transactions。

---


## 11.1 MVP Frontend Information Architecture

当前前端 MVP 以 **Dashboard 作为首页入口和跨页面跳转中枢**。专题页负责深度分析，Transactions 页面作为所有分析的底层明细与数据修正中心。详细页面导航、跳转规则和 Dashboard 第一版规格维护在 `docs/MVP_FRONTEND_NAVIGATION.md`。

### 11.1.1 侧边栏与核心路由

```text
Dashboard        /dashboard
Cash             /cash
Spending         /spending
Investments      /investments
Recap            /recap
Transactions     /transactions
Accounts         /accounts
Settings         /settings
```

### 11.1.2 页面职责

| 页面 | 核心问题 | 职责 |
|---|---|---|
| Dashboard | 我现在整体财务健康吗？ | KPI 汇总、净资产趋势、风险提醒、下一步行动、跨页面入口 |
| Cash | 我短期现金够不够？ | 现金账户、信用卡短期负债、未来付款、30/60/90 天现金流风险 |
| Spending | 我这个月钱花在哪里？ | 收入/支出、预算、分类、商户、周期费用、消费 insight |
| Investments | 我的资产表现如何？ | 持仓、组合市值、收益、资产配置、多币种和 FX 暴露 |
| Recap | 这个月/季度发生了什么？ | 月度/季度/年度总结、显著变化、风险、行动建议 |
| Transactions | 底层交易数据是否正确？ | 搜索、筛选、分类修正、排除、转账标记、本地规则生成 |
| Accounts | 数据源是否健康？ | 连接账户、手动账户、同步状态、source/last updated/confidence |
| Settings | 系统如何解释我的数据？ | 预算、分类规则、预测假设、币种、时区、隐私和 AI 模式 |

### 11.1.3 跳转原则

```text
/ -> /dashboard

/dashboard
├── /cash
├── /spending
├── /investments
├── /recap
├── /transactions
├── /accounts
└── /settings
```

- Dashboard 只展示摘要、风险和下一步行动，不承载所有细节。
- Cash、Spending、Investments、Recap 等专题页负责分析。
- Transactions 负责 drill-down、数据修正和分类规则创建。
- 页面跳转通过 query 参数保留上下文，例如 `period=2026-05`、`category=Dining`、`merchant=Netflix`、`account=cibc-visa`、`review=true`、`section=recurring`。

### 11.1.4 Dashboard 第一版范围

Dashboard 第一版建议包含：

1. Header：以 Total Net Worth 作为第一视觉焦点，同时展示较昨日变化的金额和百分比、用户目标进度（例如 FIRE 目标名、目标金额和进度条）、当前周期、数据状态 chip、Add data 快捷入口；
2. KPI Navigation Cards：Cash、Investments、Spending、Accounts、Recap、Risk（Risk 的最终口径待 alerts/risk 生成逻辑确定）；
3. Main Content Grid：桌面端使用 Net Worth Trend + Needs Attention 左右布局，移动端将 Needs Attention 放在 Trend 前方；
4. Secondary Insight Row：Cashflow Forecast Preview、Spending Insight Preview、Recap / Goal Progress Preview；
5. Quick Actions：优先通过 Header Add data 菜单和 Needs Attention 承载；只有空数据或 onboarding 状态才强展示大号快捷操作区。

Dashboard 点击跳转示例：

| Dashboard 元素 | 跳转 |
|---|---|
| Total Net Worth | `/investments`，未来可跳 `/net-worth` |
| Goal Progress | `/settings?section=goals` |
| Cash KPI | `/cash` |
| Investments KPI | `/investments` |
| Spending KPI | `/spending` |
| Accounts KPI / Data Status | `/accounts` |
| Recap KPI | `/recap?period=...` |
| Risk KPI | 根据最高优先级风险跳 `/cash`、`/spending`、`/accounts` 或 `/transactions?review=true` |

## 12. MVP 开发路线

### Phase 0：Foundation

周期：2-4 周

任务：

- Auth；
- DB schema；
- user settings；
- manual account；
- manual holdings；
- basic dashboard shell。

### Phase 1：Banking + Spending MVP

周期：4-6 周

任务：

- SimpleFIN integration；
- account sync；
- transaction sync；
- transaction classification；
- merchant normalization；
- transfer matching；
- monthly spending dashboard。

### Phase 2：Investment Valuation MVP

周期：4-6 周

任务：

- holdings management；
- yfinance adapter；
- FX adapter；
- valuation engine；
- portfolio dashboard；
- net worth snapshot。

### Phase 3：Recurring + Forecast

周期：3-5 周

任务：

- recurring detection；
- annualized cost；
- next payment prediction；
- cashflow forecast；
- net worth forecast。

### Phase 4：File Upload + AI Summary

周期：4-6 周

任务：

- statement upload；
- OCR pipeline；
- holding candidate review；
- AI monthly report；
- insight generation。

---

## 13. 核心技术风险与解决方案

| 风险 | 解决方案 |
|---|---|
| SimpleFIN 覆盖不完整 | 提供 Manual Mode、CSV/PDF 导入、connection health |
| 交易分类不准 | 用户修正、merchant rules、分类置信度、加拿大商户字典 |
| 投资数据不完整 | 区分 estimated return 和 verified return，要求用户确认持仓 |
| 行情源不稳定 | 价格缓存、stale price 标记、provider adapter 抽象 |
| 净资产变化误判 | transfer matching、contribution/return 分离、waterfall attribution |
| 隐私和合规风险 | 不保存银行密码、加密、可删除、AI 脱敏、法律审查 |

---

## 14. 最终系统能力总结

最终产品应形成 5 个核心引擎：

```text
1. Transaction Intelligence Engine
   交易清洗、分类、商户标准化、转账识别

2. Recurring Cost Engine
   订阅、周期费用、年化成本、下次扣款预测

3. Valuation Engine
   持仓估值、每日盈亏、总收益、多币种折算

4. Net Worth Engine
   总资产、总负债、净资产趋势、变化归因

5. Forecast & Insight Engine
   消费预测、现金流预测、净资产预测、AI 财务总结
```

---

## 15. MVP 最小闭环

```text
连接 SimpleFIN
→ 同步账户和信用卡交易
→ 分类消费
→ 排除转账和信用卡还款
→ 手动添加投资持仓
→ 每日获取行情
→ 计算投资市值
→ 生成净资产 Dashboard
→ 展示月度消费和订阅
→ 给出月底现金流预测
```

---

## 16. 产品一句话定义

> 一个面向个人用户的隐私优先型金融智能 Dashboard，通过 SimpleFIN、手动持仓、账单上传和市场行情数据，将银行、信用卡、投资、负债和周期费用整合为统一的净资产、消费、收益和现金流预测系统。

---

## 17. 下一步建议

建议下一步直接拆成四份工程交付物：

1. **MVP Frontend Navigation**
   - 维护在 `docs/MVP_FRONTEND_NAVIGATION.md`，用于沉淀侧边栏、路由、页面职责、Dashboard 规格和跨页面 drill-down 规则；
2. **MVP Backlog**
   - 按 Epic / Feature / User Story / Acceptance Criteria 拆解；
3. **Database ERD**
   - 明确表关系、索引、数据流；
4. **Dashboard Wireframe**
   - 首页、Cash、Spending、Investments、Recap、Transactions、Accounts、Settings 的页面结构。
