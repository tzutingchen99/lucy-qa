> 大部分的學習，其實不是在「寫程式」的時候發生的，是在「跟人解釋程式」的時候發生的

開這個站，其實就是為了這件事

很多事情我以為自己理解了，等到要寫出來才發現根本沒想清楚。所以這裡對我來說，比較像是 **自己整理思緒的地方**，順便把整理好的東西放出來。有人剛好看到、覺得有用，是 bonus

## 已寫的

**術語 / 概念**

- [測試層級與類型](../test-levels/) — Unit、Integration、E2E、Smoke、Sanity、UAT，差在你選擇相信什麼
- [測試設計技術](../test-design/) — 等價分割、邊界值、決策表、狀態轉換，讓覆蓋有依據
- [Bug 的語言](../bug-language/) — Bug、Defect、Severity、Priority，這些詞說的不一定是同一件事
- [測試文件與流程](../test-docs/) — Test Plan、DoD、Acceptance Criteria 是什麼、怎麼用
- [Flaky、Coverage、Regression：你說的跟我說的一樣嗎？](../common-terms/) — 被說爛的詞，重新說清楚
- [API 測試術語](../api-testing/) — Contract Testing、Schema Validation、冪等，都在回答同一個問題

**原則**

- [驗意圖，不要驗實作](../intent-vs-implementation/) — 重構後測試全紅但沒 bug，問題在哪

**Bug Report**

- [Bug Report 的最小單位是什麼](../bug-report-minimum-unit/) — 收到「這個壞掉了」之後，缺的是什麼

## 還在排隊的

**術語 / 概念（系列的其他集數）**

- **Test Double** — Mock、Stub、Fake、Spy，差在意圖
- 再後面：自動化術語、CI/CD、效能測試、AI 時代的新術語

**自動化**

- **Pabot 平行化的坑**
- **keyword 設計** — 命名用使用者語言，不要用內部函式名
- **Page Object 什麼時候是負債** — 抽象搭錯方向的代價，比沒抽象還貴

**效能**

- **k6 跟 Locust**
- **壓得很慘 vs 找到真實瓶頸**

**AI 在 QA 流程裡**

- **Claude Code 進 QA workflow** — 哪些事適合丟給它、哪些丟了你會後悔
- **MCP 串內部系統** — 一個 server 解掉多少手工流程的真實數字
- **AI 做 spec review** — 可以接到什麼程度，又會在哪裡掉鏈子

**原則**

- **測試金字塔在 2026 年還成立嗎** — 經典模型遇到 AI / serverless / 微服務的拉扯

**Spec / 流程**

- **Spec review 該抓什麼、放過什麼** — 一個 QA 在 spec review 的攻防取捨
- **跟 PM / RD 對齊驗收條件** — 不是把驗收條件寫死，而是讓三方語言一致

## 寫法

- 短文為主，事情寫清楚就好，不灌水
- 程式碼用真實情境，不會貼一段沒有 context 的 snippet
- 想到什麼就寫什麼，不會按進度表

如果你也是做 QA 的，或正在猶豫要不要走這條路，歡迎來 [Threads](https://www.threads.com/@qauluru) 找我聊
