# 驗意圖，不要驗實作

## 一個小場景

你花了一個下午重構一段邏輯。沒改 API、沒改回傳、行為一模一樣，只是把幾個 if-else 收進一個函式。跑測試——50 個紅了。

仔細看才發現：那些測試在斷言「`_calculate_discount` 有被呼叫」、「內部走了第二條 path」、「mock 的 SQL 字串長這樣」。

功能沒壞，但測試說壞了。**這種測試在驗「你怎麼寫的」，不是「你要做的事」。**

## 一個比喻

你叫外送。你在乎的是：**東西有沒有送到、品項對不對、溫度可不可以**。這就是「意圖」。

你不在乎：**騎手騎哪條路、用哪個包包、停哪個紅綠燈**。這些是「實作」。

好的驗收，是檢查送到的東西。壞的驗收，是裝 GPS 跟騎手吵說「你為什麼不走我期待的那條路」——他換了條更快的路你還氣他。

**意圖 = 對外承諾的契約**（行為、結果、狀態）
**實作 = 為了做到那個承諾，內部選用的資料結構、函式、SQL、第三方 lib**

換句話說：意圖紅了，是真的有 bug；實作紅了，多半只是有人換了條更快的路。

## 一個對照例

假設要驗「VIP3 客戶下 100 USDT 的單，手續費應該是 0.05」。

**驗實作（不好）**

```python
def test_calculate_fee():
    calc = FeeCalculator(tier="VIP3")
    calc.calculate(100)
    assert calc._apply_vip_discount.called      # 偷看內部
    assert calc._round_to_8_decimals.called     # 偷看內部
```

之後你把 VIP 折扣改成查表、把 rounding 內聯掉——測試紅，但結果完全正確。

**驗意圖（好）**

```python
def test_calculate_fee():
    fee = FeeCalculator(tier="VIP3").calculate(notional=100)
    assert fee == Decimal("0.05000000")
```

你只在乎結果。內部怎麼算的，**不關測試的事**。

## 兩個快速判斷句

寫 assert 之前先問自己兩個問題：

1. **如果換一個合理的實作方式，這個斷言會不會打破？** 會 → 你在驗實作。
2. **使用者只看 API 文件的話，會在意這件事嗎？** 不會 → 你在驗實作。

兩題只要有一題答「是」，就把那個 assert 改成「對結果的斷言」。

## 例外：什麼時候可以驗實作

不是所有實作細節都不能驗。三種情況例外，但要意識到自己在做例外：

- **實作本身就是契約**——例如「這個 API 必須冪等」、「失敗一定要寫 audit log」。這些不是細節，是承諾。
- **回歸測試固化已知 bug**——例如某次 race condition 修好後，明確驗「順序是 lock → cancel」。「順序」就是修復的本體。
- **安全 / 合規邊界**——例如「不能 log 完整卡號」、「session token 不能寫 localStorage」。這類負向斷言必須驗內部，因為違反就是事故。

## 實務上怎麼套用

| 場景 | 怎麼做 |
|---|---|
| Robot Framework keyword 設計 | keyword 名字用「使用者語言」(`下單`)，不要用「內部函式名」(`Call Matching Engine`) |
| 撮合引擎測試 | 驗「成交價、剩餘量、撮合方向」，不要驗「內部走了哪個 priority queue」 |
| API 自動化 | assert response body / status / DB 終態，不要 mock 中間步驟然後 assert mock 被呼叫 |
| Spec review | 看到 spec 寫「X 元件會呼叫 Y service 三次」就提出來 — 這是實作細節，不該入 spec |

## 一句話收尾

> **重構之後測試應該全綠。如果不是綠的，要嘛功能真的壞了，要嘛你的測試在驗錯的東西。**

紅得有意義是品質訊號，紅得是雜訊就是測試債。
