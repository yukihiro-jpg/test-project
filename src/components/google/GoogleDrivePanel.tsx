'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCaseStore } from '@/lib/store/case-store';
import {
  authenticate, logout, isAuthenticated,
  saveAllCasesToDrive, loadAllCasesFromDrive,
  getStoredClientId, storeClientId, setGoogleClientId,
} from '@/lib/google/drive';
import { Cloud, CloudOff, Upload, Download, Settings, Check, AlertCircle } from 'lucide-react';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function GoogleDrivePanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [clientId, setClientId] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<Status>('idle');
  const [loadStatus, setLoadStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const cases = useCaseStore(s => s.cases);
  const initialize = useCaseStore(s => s.initialize);

  useEffect(() => {
    const stored = getStoredClientId();
    if (stored) {
      setClientId(stored);
      setGoogleClientId(stored);
    }
    setAuthenticated(isAuthenticated());
  }, []);

  const handleSaveClientId = () => {
    if (!clientId.trim()) return;
    storeClientId(clientId.trim());
    setGoogleClientId(clientId.trim());
    setShowSettings(false);
    setMessage('Client IDを保存しました');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleConnect = async () => {
    try {
      await authenticate();
      setAuthenticated(true);
      setMessage('Googleドライブに接続しました');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '接続エラー');
    }
  };

  const handleDisconnect = () => {
    logout();
    setAuthenticated(false);
    setMessage('切断しました');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSave = async () => {
    setSaveStatus('loading');
    setMessage('');
    try {
      await saveAllCasesToDrive(cases);
      setSaveStatus('success');
      setMessage('Googleドライブに保存しました');
      setTimeout(() => { setSaveStatus('idle'); setMessage(''); }, 3000);
    } catch (err) {
      setSaveStatus('error');
      setMessage(err instanceof Error ? err.message : '保存エラー');
    }
  };

  const handleLoad = async () => {
    setLoadStatus('loading');
    setMessage('');
    try {
      const data = await loadAllCasesFromDrive();
      if (data && Array.isArray(data)) {
        // localStorageに上書き保存して再初期化
        localStorage.setItem('souzoku-cases', JSON.stringify(data));
        initialize();
        setLoadStatus('success');
        setMessage(`${data.length}件の案件をGoogleドライブから復元しました`);
        setTimeout(() => { setLoadStatus('idle'); setMessage(''); }, 3000);
      } else {
        setLoadStatus('idle');
        setMessage('Googleドライブにデータが見つかりませんでした');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setLoadStatus('error');
      setMessage(err instanceof Error ? err.message : '読み込みエラー');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {authenticated ? (
              <Cloud size={18} className="text-green-600" />
            ) : (
              <CloudOff size={18} className="text-gray-400" />
            )}
            Googleドライブ連携
          </CardTitle>
          <Button variant="secondary" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={14} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showSettings && (
          <div className="space-y-2 p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-500">
              Google Cloud ConsoleでOAuth2クライアントIDを作成し、ここに入力してください。
            </p>
            <Input
              label="Google Client ID"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              placeholder="xxxxx.apps.googleusercontent.com"
            />
            <Button size="sm" onClick={handleSaveClientId}>保存</Button>
          </div>
        )}

        {!authenticated ? (
          <Button onClick={handleConnect} className="w-full" disabled={!clientId}>
            <Cloud size={16} className="mr-2" />
            Googleドライブに接続
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check size={14} />
              接続済み
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSave}
                disabled={saveStatus === 'loading'}
              >
                <Upload size={14} className="mr-1" />
                {saveStatus === 'loading' ? '保存中...' : '保存'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleLoad}
                disabled={loadStatus === 'loading'}
              >
                <Download size={14} className="mr-1" />
                {loadStatus === 'loading' ? '読込中...' : '復元'}
              </Button>
            </div>
            <Button variant="secondary" size="sm" onClick={handleDisconnect} className="w-full text-xs">
              切断
            </Button>
          </div>
        )}

        {message && (
          <div className={`text-xs p-2 rounded ${
            saveStatus === 'error' || loadStatus === 'error'
              ? 'bg-red-50 text-red-700'
              : 'bg-green-50 text-green-700'
          }`}>
            {message}
          </div>
        )}

        <p className="text-xs text-gray-400">
          保存先: 【削除禁止】相続税業務管理アプリ
        </p>
      </CardContent>
    </Card>
  );
}
