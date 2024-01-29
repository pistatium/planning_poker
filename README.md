# プランニングポーカー

![image](https://github.com/pistatium/planning_poker/assets/394378/321801b3-098c-4a0f-ab84-3c54610d261b)

スクラム用のプランニングポーカーです。

## 特徴
* アカウント作成不要
* 部屋のURLを共有するだけで利用可能
* WebSocketによるリアルタイム同期
* 平均計算
* 見積もりログ

## 構成
* CloudRun + Firestore
* Go製のWebSocketサーバーでリアルタイムに通信しています
* FirestoreはCloudRunのインスタンス切り替え時にデータを引き継ぐために利用
* FIXME: フロントをReactなどでちゃんと書きなおす


## サーバー

### 受信イベント

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

### 送信イベント

participants
* 現在の状態を通知するイベント
* 適宜送信されます
* 現在の参加者情報、見積もり状態を送信

estimates
* 誰かが見積もりを開示したときに飛ぶイベント
* 見積もり結果を送信