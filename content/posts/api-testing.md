# API 測試術語

> [!TLDR] API 測試打在真實業務邏輯上，又比 E2E 快而穩，是 CP 值最高的測試層。Contract Testing 解「前後端理解不一致」、Schema Validation 是起點不是終點、冪等驗的是伺服器狀態不是 status code——全部都在回答同一個問題：這個介面的行為，跟呼叫方的期待一致嗎

## 為什麼 API 測試 CP 值高

E2E 測試慢、脆、維護成本高。Unit test 快但只驗一個點

API 測試在中間：直接打服務的介面，不需要 UI，但驗的是真實的業務邏輯和整合行為。速度快很多，穩定很多，能覆蓋的範圍又比 unit test 廣

不少團隊發現，把資源集中在 API 層的測試，找到的 bug 比 E2E 多、比 unit test 更接近真實問題

---

## REST vs GraphQL：測試策略的差異

這兩種 API 設計風格，測試的重點不太一樣

**REST**：每個資源有獨立的 endpoint，HTTP 方法（GET/POST/PUT/DELETE）有語意

測試重點：
- Status code 對不對（200、201、400、404、500）
- Response body 的格式和內容
- 錯誤情境的處理

**GraphQL**：一個 endpoint，用 query 語言描述你要什麼資料

測試重點稍微不同：
- Query 語法正確性
- 回傳的欄位是否符合 schema
- Mutation 的副作用（資料有沒有真的被改）
- Resolver 的授權邏輯

將後兩點展開講

**Mutation 的副作用**：GraphQL 裡 Query 是讀、Mutation 是寫（類似 REST 的 POST/PUT/DELETE）。陷阱在於 Mutation 的 response 說成功，不代表資料真的改了——resolver 有可能只是把你送進去的值原樣回給你，資料庫根本沒寫進去。所以不能只驗 response，還要再查一次確認值真的變了，而且不該被改的欄位沒有跟著變

**Resolver 的授權邏輯**：Resolver 是 server 端負責「每個欄位回傳什麼」的函式。REST 通常在 endpoint 層級擋權限，但 GraphQL 只有一個 endpoint，權限必須做在 resolver（欄位）層級。常見的漏洞是最外層的 query 有檢查，巢狀欄位卻沒有：

```graphql
query {
  user(id: 2) {
    name               # 公開欄位，OK
    salary             # 這個 resolver 有沒有檢查「只有本人或 HR 能看」？
    orders { total }   # 一路巢狀查下去，有沒有再驗一次權限？
  }
}
```

測法是用不同角色（未登入、一般使用者、admin）送同一個 query，確認敏感欄位對沒權限的人回傳 null 或錯誤，而不是把資料吐出來

GraphQL 的好處是前端只拿需要的欄位，但測試時要留意 schema 改了有沒有 breaking change

---

## Contract Testing（契約測試）

很多 integration bug 不是邏輯錯，是前後端對介面的理解不同

後端說欄位叫 `user_id`，前端以為是 `userId`。後端說回傳是陣列，前端以為是物件。這種錯誤在各自的測試裡看不出來，要接在一起才會炸

Contract Testing 就是解這個問題：定義一份「契約」，描述服務之間的介面約定。消費方（Consumer）和提供方（Provider）都要通過這份契約的驗證

只要契約成立，你不需要把整個系統啟動起來做 Integration test，就能確認接口兼容

---

## Consumer-Driven Contract

Contract Testing 有個問題：誰來定契約？

**Consumer-Driven Contract** 的答案是：由消費方（呼叫 API 的那方）來定義它需要什麼

Provider 的責任是確保它的實作能滿足所有 Consumer 定義的期望

這個方向反過來了——不是 Provider 說「我提供什麼」，而是 Consumer 說「我需要什麼」

常見工具：Pact。Consumer 跑測試的時候會產生一份 Pact 檔，Provider 拿這份檔來驗證自己的實作

---

## Schema Validation（格式驗證）

API 回傳了「格式正確的東西」，不代表業務邏輯對了。但格式不正確，業務邏輯有沒有對就先不用看了

Schema Validation 驗的是：
- 欄位存不存在
- 型別對不對（string vs number）
- 必填欄位有沒有填
- 格式對不對（email 格式、日期格式）

常見工具：JSON Schema、Pydantic、OpenAPI spec 驗證

Schema Validation 是測試的起點，不是終點。格式對了之後，還要驗值是不是有意義的

---

## Idempotent（冪等）

**冪等的定義**：同一個操作執行多次，結果跟執行一次一樣

```
GET /orders/123    → 冪等（多次讀取，結果一樣）
DELETE /orders/123 → 冪等（刪了就是刪了，再刪一次還是刪掉的狀態）
POST /orders       → 通常不冪等（每次建立一筆新的）
```

一個容易踩的細節：DELETE 的冪等指的是**伺服器狀態**，不是 response——第二次 DELETE 常會回 404 而不是 204。看到 status code 不一樣就判定「不冪等」，是這個詞最常見的誤讀

網路不穩的時候，請求可能被重送。如果 POST 不冪等，使用者點一下「送出訂單」，網路延遲讓他以為沒反應，再點一次——結果建了兩筆訂單

測冪等性：送同一個請求兩次、三次，驗結果是不是一樣。付款、訂單建立、任何「重複執行會造成問題」的操作都值得特別留意

---

## 一個結論

> **API 測試的核心問題只有一個：這個介面的行為，跟呼叫方的期待一致嗎？格式、契約、冪等，都是在回答這個問題的不同面向**
