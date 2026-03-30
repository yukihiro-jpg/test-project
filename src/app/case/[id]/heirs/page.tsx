'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WarekiInput } from '@/components/common/wareki-input';
import { calculateAge, toWareki } from '@/lib/dates/wareki';
import { calculateLegalShareRatios } from '@/lib/tax/deductions';
import { RELATIONSHIP_LABELS, type RelationshipType } from '@/types';
import { Plus, Trash2 } from 'lucide-react';

const RELATIONSHIP_OPTIONS = Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export default function HeirsPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addHeir = useCaseStore(s => s.addHeir);
  const updateHeir = useCaseStore(s => s.updateHeir);
  const removeHeir = useCaseStore(s => s.removeHeir);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const { heirs, referenceDate } = currentCase;
  const legalShareRatios = calculateLegalShareRatios(heirs);

  const handleAdd = () => {
    addHeir({
      name: '',
      birthDate: '',
      address: '',
      relationship: 'child',
      isDisabled: false,
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">相続人情報</h1>
        <Button onClick={handleAdd}>
          <Plus size={18} className="mr-2" />
          相続人追加
        </Button>
      </div>

      {heirs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500 mb-4">相続人が登録されていません</p>
            <Button onClick={handleAdd}>
              <Plus size={18} className="mr-2" />
              相続人を追加
            </Button>
          </CardContent>
        </Card>
      ) : (
        heirs.map((heir, index) => {
          const age = calculateAge(heir.birthDate, referenceDate);
          const legalShare = legalShareRatios.get(heir.id) || 0;
          const legalSharePercent = (legalShare * 100).toFixed(1);

          return (
            <Card key={heir.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>相続人 {index + 1}</CardTitle>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (confirm('この相続人を削除しますか？')) removeHeir(heir.id);
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="氏名"
                    value={heir.name}
                    onChange={e => updateHeir(heir.id, { name: e.target.value })}
                    placeholder="山田 花子"
                  />
                  <Select
                    label="続柄"
                    value={heir.relationship}
                    onChange={e => updateHeir(heir.id, { relationship: e.target.value as RelationshipType })}
                    options={RELATIONSHIP_OPTIONS}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <WarekiInput
                    label="生年月日"
                    value={heir.birthDate}
                    onChange={v => updateHeir(heir.id, { birthDate: v })}
                  />
                  {heir.birthDate && (
                    <div className="flex items-end pb-1">
                      <span className="text-sm text-gray-600">
                        基準日時点: <span className="font-semibold">{age}歳</span>
                        {age < 18 && <span className="ml-2 text-orange-600">（未成年）</span>}
                      </span>
                    </div>
                  )}
                </div>

                <Input
                  label="住所"
                  value={heir.address}
                  onChange={e => updateHeir(heir.id, { address: e.target.value })}
                  placeholder="東京都..."
                />

                <div className="flex items-center gap-6">
                  <Checkbox
                    label="障害者"
                    checked={heir.isDisabled}
                    onChange={e => updateHeir(heir.id, { isDisabled: (e.target as HTMLInputElement).checked })}
                  />
                  {heir.isDisabled && (
                    <Select
                      label=""
                      value={heir.disabilityType || 'general'}
                      onChange={e => updateHeir(heir.id, { disabilityType: e.target.value as 'general' | 'special' })}
                      options={[
                        { value: 'general', label: '一般障害者' },
                        { value: 'special', label: '特別障害者' },
                      ]}
                    />
                  )}
                </div>

                <div className="bg-blue-50 rounded-md p-3 text-sm">
                  法定相続分: <span className="font-semibold text-blue-700">{legalSharePercent}%</span>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
