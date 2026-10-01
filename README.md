# @zixcel/github-auth

GitHub OAuth Device Flowを、製品UI、HTTP transport、credential custodyから分離する
provider固有の認証Planです。利用者はAppを作成せず、配布者が一度だけ登録した公開
client IDを使います。SaaS側はclient IDとDevice Flow有効化だけです。

- 通信は注入されたtransportだけを使い、browserを開きません。
- client secret、App秘密鍵、callback serverを必要としません。
- access tokenは注入されたcustody portへ直接渡し、結果には含めません。
- `connection_ref`の発行・保管はCrowsi Credential Agentの責務です。
- HAT、Hatter、Coelaなどconsumer固有の概念を持ちません。
- Consumerは宣言されたplacementを実測し、利用不能を推測で補完しません。
- provider networkとCrowsi custodyが同じローカル配置で利用できる場合だけ開始します。

```js
import { githubAuthDeclaration, requestGitHubDeviceCode }
  from '@zixcel/github-auth'

const declaration = githubAuthDeclaration()
const attempt = await requestGitHubDeviceCode(declaration,
  { clientId: 'Iv23Public', nowUnixMs: Date.now() }, transport)
```

削除を申請する場合だけ `githubAuthDeclaration({ allowRepositoryDeletion: true })` として `delete_repo` を追加します。要求scopeはattemptへ束縛し、未要求のscope追加と不足scopeをcustodyへ渡す前に拒否します。既定のclassic OAuth `repo` scopeはprovider側では書込能力を含みます。読み取り専用の実行制限は `zixcel-github` のローカル設定で行い、provider側も読取最小権限にしたい場合はGitHub Appまたはfine-grained tokenをCrowsiへ登録してください。削除scopeの申請はGitHub organizationの管理権限付与を代行しません。

## License / ライセンス

The current distribution uses Apache-2.0; see LICENSE and NOTICE. Earlier permissions and third-party terms remain in effect. Private registration, credentials and runtime state are excluded.

現在の配布版はApache-2.0です。LICENSEとNOTICEを参照してください。従前の許諾・第三者条件は保持します。非公開登録データ・認証情報・実行時状態は配布対象外です。
