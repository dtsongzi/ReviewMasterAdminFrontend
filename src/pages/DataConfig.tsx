import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import type { DataConfig } from '../api';
import { ErrorMsg, Panel } from '../components/ui';

/** 数据源代理设置：系统级配置，仅管理员可用（主站入口已移除）。 */
export function DataConfigPage() {
  const [form, setForm] = useState<DataConfig>({ emProxy: '', cninfoProxy: '', cninfoOpenPdf: false });
  const [baseline, setBaseline] = useState<DataConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    adminApi.dataConfig()
      .then((r) => {
        if (!alive) return;
        const next = { emProxy: r.emProxy || '', cninfoProxy: r.cninfoProxy || '', cninfoOpenPdf: !!r.cninfoOpenPdf };
        setForm(next); setBaseline(next);
      })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);

  const dirty = !!baseline && (
    form.emProxy !== baseline.emProxy || form.cninfoProxy !== baseline.cninfoProxy || form.cninfoOpenPdf !== baseline.cninfoOpenPdf
  );

  async function save() {
    if (!dirty || busy) return;
    if (!window.confirm('保存后立即作用于全站行情/公告抓取，确定继续？')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await adminApi.saveDataConfig(form);
      const next = { emProxy: r.emProxy || '', cninfoProxy: r.cninfoProxy || '', cninfoOpenPdf: !!r.cninfoOpenPdf };
      setForm(next); setBaseline(next);
      setNotice('✓ 已保存并生效');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>数据源设置</h1>
          <div className="muted" style={{ marginTop: 4 }}>代理配置影响全站抓取，仅管理员可读写</div>
        </div>
        <div className="ma-actions">
          <button className="btn-ghost" disabled={!dirty || busy} onClick={() => baseline && setForm({ ...baseline })}>撤销更改</button>
          <button className="btn-primary" disabled={!dirty || busy} onClick={() => void save()}>{busy ? '保存中…' : dirty ? '保存生效' : '已保存'}</button>
        </div>
      </div>

      <ErrorMsg msg={error} />
      {notice ? <div className="ma-notice ok">{notice}</div> : null}

      <Panel title="代理配置">
        <div className="ma-form">
          <label className="fld">
            <span>东方财富代理</span>
            <input className="rc-inp" value={form.emProxy} onChange={(e) => setForm({ ...form, emProxy: e.target.value })} placeholder="留空表示直连，例如 http://proxy.example.com:8080" />
            <small className="muted">仅支持 http/https 公网地址，内网地址会被拒绝。</small>
          </label>
          <label className="fld">
            <span>巨潮资讯代理</span>
            <input className="rc-inp" value={form.cninfoProxy} onChange={(e) => setForm({ ...form, cninfoProxy: e.target.value })} placeholder="留空表示沿用东财代理或环境变量" />
          </label>
          <label className="fld fld-inline">
            <input type="checkbox" checked={form.cninfoOpenPdf} onChange={(e) => setForm({ ...form, cninfoOpenPdf: e.target.checked })} />
            <span>公告「原文」直接打开 PDF（关闭则跳转公告详情页）</span>
          </label>
        </div>
      </Panel>
    </div>
  );
}
