'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WarekiInput } from '@/components/common/wareki-input';
import { calculateAge, toWareki } from '@/lib/dates/wareki';
import { Save } from 'lucide-react';

export default function DecedentPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const updateDecedent = useCaseStore(s => s.updateDecedent);
  const updateCurrentCase = useCaseStore(s => s.updateCurrentCase);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const { decedent, referenceDate } = currentCase;
  const age = calculateAge(decedent.birthDate, referenceDate);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">被相続人情報</h1>

      <Card>
        <CardHeader>
          <CardTitle>基準日設定</CardTitle>
        </CardHeader>
        <CardContent>
          <WarekiInput
            label="基準日"
            value={referenceDate}
            onChange={v => updateCurrentCase({ referenceDate: v })}
            showWareki
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>被相続人</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="氏名"
            value={decedent.name}
            onChange={e => updateDecedent({ name: e.target.value })}
            placeholder="山田 太郎"
          />

          <WarekiInput
            label="生年月日"
            value={decedent.birthDate}
            onChange={v => updateDecedent({ birthDate: v })}
          />

          {decedent.birthDate && (
            <div className="text-sm text-gray-600">
              基準日時点の年齢: <span className="font-semibold">{age}歳</span>
            </div>
          )}

          <WarekiInput
            label="死亡日（任意）"
            value={decedent.deathDate || ''}
            onChange={v => updateDecedent({ deathDate: v })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="住所"
              value={decedent.address}
              onChange={e => updateDecedent({ address: e.target.value })}
              placeholder="東京都千代田区..."
            />
            <Input
              label="電話番号"
              value={decedent.phone || ''}
              placeholder="090-xxxx-xxxx"
              onChange={e => updateDecedent({ phone: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
