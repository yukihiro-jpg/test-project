# デプロイ手順

## 前提

- Google Cloud プロジェクトが作成済み（課金アカウントを紐付け）
- 以下の API を有効化:
  - Cloud Run API
  - Cloud Build API
  - Artifact Registry API
  - Cloud Firestore API
  - Gmail API
  - Google Drive API
  - Generative Language API

## 初回セットアップ

### 1. Artifact Registry リポジトリ作成

```bash
gcloud artifacts repositories create financial-report-app \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="月次財務報告アプリ"
```

### 2. Firestore 初期化

```bash
gcloud firestore databases create --location=asia-northeast1
```

### 3. Cloud Storage バケット作成

```bash
gsutil mb -l asia-northeast1 -b on gs://${PROJECT_ID}-financial-report-uploads

# ライフサイクルルール（3ヶ月経過したオブジェクトを削除）
cat > /tmp/lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      { "action": {"type": "Delete"}, "condition": {"age": 90} }
    ]
  }
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://${PROJECT_ID}-financial-report-uploads
```

### 4. Secret Manager でシークレット登録

```bash
echo -n "$(openssl rand -hex 32)" | gcloud secrets create session-secret --data-file=-
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
echo -n "YOUR_ESTAT_APP_ID" | gcloud secrets create estat-app-id --data-file=-
echo -n "YOUR_OAUTH_CLIENT_ID" | gcloud secrets create oauth-client-id --data-file=-
echo -n "YOUR_OAUTH_CLIENT_SECRET" | gcloud secrets create oauth-client-secret --data-file=-
```

### 5. Cloud Run サービスアカウントに権限付与

```bash
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/secretmanager.secretAccessor"
```

### 6. Firestore セキュリティルール適用

```bash
# firestore.rules 内の "your@gmail.com" を実際の許可メールに置換してから
gcloud firestore rules deploy firestore.rules
```

### 7. OAuth クライアント設定

[Google Cloud Console の認証情報ページ](https://console.cloud.google.com/apis/credentials) で OAuth 2.0 クライアントIDを作成：
- アプリケーションの種類: Web アプリケーション
- 承認済みのリダイレクトURI: `https://YOUR-CLOUD-RUN-URL/api/auth/callback`

## デプロイ

```bash
gcloud builds submit --config cloudbuild.yaml
```

初回デプロイ後、Cloud Run の URL を OAuth クライアントのリダイレクトURIに追加する必要がある。

## ドメイン設定（任意）

独自ドメインを使用する場合：

```bash
gcloud run domain-mappings create \
  --service=financial-report-app \
  --domain=finance.example.com \
  --region=asia-northeast1
```

## 運用

### ログ確認

```bash
gcloud run logs read financial-report-app --region=asia-northeast1 --limit=50
```

### スケール設定

Cloud Run は min-instances=0（コールドスタート許容）、max-instances=3 で運用。
税理士1名のみが使用する想定なので、並行リクエストはほぼない。

### コスト目安

- Cloud Run: 無料枠内（毎月 200万リクエスト・360,000 GB秒まで無料）
- Firestore: 無料枠内（毎日 20,000 書き込み・50,000 読み取りまで無料）
- Cloud Storage: 5GB まで無料
- Gemini 2.5 Flash: 非常に低コスト（毎月数百円想定）
- e-Stat API: 無料

合計で月 500円〜1,000円程度の想定（Cloud Run のアイドル時間課金が主）。
