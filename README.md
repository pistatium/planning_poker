# プランニングポーカー

![image](https://github.com/pistatium/planning_poker/assets/394378/321801b3-098c-4a0f-ab84-3c54610d261b)

スクラム用のプランニングポーカーです。

## 特徴
* アカウント作成不要
* 部屋のURLを共有するだけで利用可能
* WebSocketによるリアルタイム同期
* 平均計算
* 見積もりログ

## 仕組み
* deno の WebSocket サーバーとそれに接続するクライアントから構成されています。
  * DBなどの永続化の仕組みは今のところありません
    * 都度部屋を作って都度使い捨てるような運用を想定しています
  * なぜ deno か
    * deno deploy が使いたかったのがもともとです
    * deno deployだとインスタンス数が不定なので運が悪いと同じ部屋に入れない問題があります
      * Cloud Run でインスタンス数 1 で固定するみたいな運用がいいかもです


https://zenn.dev/articles/996f1c64ef58f3/edit


## サーバー

join(roomId, userName):
* ルームに入る
  * ルームがなければ作る
* 全員に参加者情報を通知

estimate(roomId, userName, point):
* Pointを保存
* 全員に参加者情報を通知

reveal(roomId, userName):
* 参加者全員のPointをNotSetに
* 全員に投票結果を通知

reset(roomId, userName):
* 参加者全員のPointをNotSetに
* 全員に参加者情報を通知
