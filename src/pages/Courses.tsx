import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '../api';
import type { CourseSeries, CourseStorage } from '../api';
import { Empty, ErrorMsg, Kpi, Panel } from '../components/ui';

// 会员课程管理：课程（系列）增删改 + 课时上传/排序/删除 + 封面上传 + 预览播放。
// 上传链路：管理平台 → ECS（本服务）→ OSS；未配置 OSS 时由服务端落本地磁盘。
// 播放链路反向：OSS → ECS → 浏览器（<video> 直连本服务，带 ?tk= 管理员令牌）。
// 因此前端只跟自己的后端通信，OSS 桶保持私有即可，无需给 OSS 配 CORS。

const INTRO_FIELDS: Array<{ k: string; label: string; ph: string }> = [
  { k: 'highlight', label: '课程亮点', ph: '一句话说明这门课解决什么问题' },
  { k: 'audience', label: '适合人群', ph: '谁最该学这门课' },
  { k: 'outline', label: '内容大纲', ph: '按讲次或模块列出主要内容' },
  { k: 'gain', label: '学完收获', ph: '学完后能具备什么能力' },
];

function fmtSize(n: number): string {
  if (!n) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return v.toFixed(v >= 10 || i === 0 ? 0 : 1) + ' ' + u[i];
}

function fmtTime(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Draft = {
  id: string; title: string; desc: string;
  teacher: string; teacherTitle: string; teacherBio: string;
  intro: Record<string, string>;
};

const emptyDraft = (): Draft => ({
  id: '', title: '', desc: '', teacher: '', teacherTitle: '', teacherBio: '',
  intro: { highlight: '', audience: '', outline: '', gain: '' },
});

export function Courses() {
  const [list, setList] = useState<CourseSeries[]>([]);
  const [storage, setStorage] = useState<CourseStorage | null>(null);
  // 上传通道：走 OSS 内网端点（同地域），默认 true，可在此页随时切换
  const [ossInternal, setOssInternal] = useState(true);
  const [savingInternal, setSavingInternal] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openId, setOpenId] = useState('');
  // 网页内预览：封面看大图、视频用内嵌播放器（不再新标签页打开）
  const [preview, setPreview] = useState<
    { kind: 'cover'; sid: string; title: string; v: number }
    | { kind: 'video'; lessonId: string; title: string; cover: boolean }
    | null
  >(null);
  const [upload, setUpload] = useState<{ sid: string; pct: number; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const uploadTarget = useRef<{ sid: string; title: string } | null>(null);
  const coverTarget = useRef<string>('');
  const noticeTimer = useRef<number | null>(null);

  const load = () => {
    setError('');
    return adminApi.courses()
      .then((d) => {
        setList(d.series || []);
        setStorage(d.storage || null);
        if (d.storage && typeof d.storage.internal === 'boolean') setOssInternal(d.storage.internal);
      })
      .catch((e) => setError(e.message || String(e)));
  };

  useEffect(() => {
    void load();
    return () => { if (noticeTimer.current !== null) clearTimeout(noticeTimer.current); };
  }, []);

  const totalLessons = useMemo(() => list.reduce((a, s) => a + s.lessonCount, 0), [list]);
  const totalSize = useMemo(() => list.reduce((a, s) => a + s.totalSize, 0), [list]);

  const flash = (t: string) => {
    setNotice(t);
    if (noticeTimer.current !== null) clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => { setNotice(''); noticeTimer.current = null; }, 3000);
  };

  // 切换「上传走内网」：保存后服务端立即生效，下一次上传即按新通道
  async function toggleInternal(next: boolean) {
    if (savingInternal) return;
    setSavingInternal(true);
    setError('');
    const prev = ossInternal;
    setOssInternal(next);           // 乐观更新
    try {
      const r = await adminApi.saveCourseSettings({ ossInternal: next });
      setOssInternal(r.ossInternal);
      if (r.storage) setStorage(r.storage);
      flash(next ? '上传已切换为内网通道' : '上传已切换为公网通道');
    } catch (e) {
      setOssInternal(prev);          // 失败回滚
      setError((e as Error).message || String(e));
    } finally { setSavingInternal(false); }
  }

  async function saveSeries() {
    if (!draft || busy) return;
    if (!draft.title.trim()) { setError('请填写课程名称'); return; }
    setBusy(true); setError('');
    try {
      const body = {
        title: draft.title.trim(), desc: draft.desc.trim(),
        teacher: draft.teacher.trim(), teacherTitle: draft.teacherTitle.trim(),
        teacherBio: draft.teacherBio.trim(), intro: draft.intro,
      };
      if (draft.id) await adminApi.updateSeries(draft.id, body);
      else {
        const r = await adminApi.createSeries(body);
        setOpenId(r.series.id);   // 新建后直接展开，方便马上传视频
      }
      setDraft(null);
      await load();
      flash('课程已保存');
    } catch (e) {
      setError((e as Error).message || String(e));
    } finally { setBusy(false); }
  }

  async function removeSeries(s: CourseSeries) {
    if (!window.confirm(`删除《${s.title}》及其全部 ${s.lessonCount} 节课？不可恢复。`)) return;
    try { await adminApi.deleteSeries(s.id); if (openId === s.id) setOpenId(''); await load(); flash('课程已删除'); }
    catch (e) { setError((e as Error).message || String(e)); }
  }

  function pickLesson(s: CourseSeries) {
    uploadTarget.current = { sid: s.id, title: '' };
    fileRef.current?.click();
  }

  async function onLessonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    const t = uploadTarget.current;
    if (!f || !t) return;
    if (storage && f.size > storage.maxSize) { setError('单个视频不能超过 ' + fmtSize(storage.maxSize)); return; }
    const title = (window.prompt('课时名称', f.name.replace(/\.[^.]+$/, '')) || '').trim();
    if (!title) return;
    setError(''); setUpload({ sid: t.sid, pct: 0, name: f.name });
    try {
      await adminApi.uploadLesson(t.sid, f, title, (pct) => setUpload((u) => (u ? { ...u, pct } : u)));
      await load();
      flash('视频已上传');
    } catch (err) {
      setError((err as Error).message || String(err));
    } finally { setUpload(null); }
  }

  function pickCover(sid: string) {
    coverTarget.current = sid;
    coverRef.current?.click();
  }

  async function onCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    const sid = coverTarget.current;
    if (!f || !sid) return;
    if (f.size > 5 * 1024 * 1024) { setError('封面需在 5MB 以内'); return; }
    setError('');
    try { await adminApi.uploadCover(sid, f); await load(); flash('封面已更新'); }
    catch (err) { setError((err as Error).message || String(err)); }
  }

  async function removeCover(s: CourseSeries) {
    if (!window.confirm('移除这门课的封面？')) return;
    try { await adminApi.updateSeries(s.id, { cover: false }); await load(); flash('封面已移除'); }
    catch (e) { setError((e as Error).message || String(e)); }
  }

  async function renameLesson(id: string, cur: string) {
    const t = (window.prompt('课时名称', cur) || '').trim();
    if (!t || t === cur) return;
    try { await adminApi.updateLesson(id, { title: t }); await load(); }
    catch (e) { setError((e as Error).message || String(e)); }
  }

  async function moveLesson(s: CourseSeries, idx: number, dir: -1 | 1) {
    const to = idx + dir;
    if (to < 0 || to >= s.lessonCount) return;
    try { await adminApi.updateLesson(s.lessons[idx].id, { seq: to }); await load(); }
    catch (e) { setError((e as Error).message || String(e)); }
  }

  async function removeLesson(id: string, title: string) {
    if (!window.confirm(`删除课时《${title}》？不可恢复。`)) return;
    try { await adminApi.deleteLesson(id); await load(); flash('课时已删除'); }
    catch (e) { setError((e as Error).message || String(e)); }
  }

  return (
    <>
      <ErrorMsg msg={error} />
      {notice ? <div className="notice-box">{notice}</div> : null}

      <div className="kpi-grid">
        <Kpi label="课程数" value={list.length} />
        <Kpi label="课时总数" value={totalLessons} />
        <Kpi label="视频占用" value={fmtSize(totalSize)} />
        <Kpi
          label="视频存储"
          value={storage?.enabled ? '阿里云 OSS' : '本机磁盘'}
          sub={storage?.enabled ? '上传经 ECS 中转，播放走反链路' : '未配置 OSS，视频存于服务器磁盘'}
          accent={storage?.enabled ? undefined : '#b8860b'}
        />
      </div>

      {storage?.enabled ? (
        <div className="storage-bar">
          <label className="storage-toggle">
            <input
              type="checkbox"
              checked={ossInternal}
              disabled={savingInternal}
              onChange={(e) => void toggleInternal(e.target.checked)}
            />
            <span>上传走 OSS 内网端点</span>
          </label>
          <span className="storage-hint">
            {ossInternal
              ? `上传/删除走 ${storage.uploadEndpoint || '内网端点'}，不占公网流量；播放仍走公网`
              : `上传/删除走 ${storage.endpoint || '公网端点'}，会消耗公网流量`}
            {storage.internalSource === 'default' ? '（当前为默认值）' : null}
          </span>
        </div>
      ) : null}

      {upload ? (
        <div className="upload-bar">
          <span>正在上传 {upload.name}</span>
          <div className="upload-track"><i style={{ width: upload.pct + '%' }} /></div>
          <b>{upload.pct}%</b>
        </div>
      ) : null}

      <Panel
        title="课程列表"
        extra={<button className="btn-primary" onClick={() => setDraft(emptyDraft())}>+ 新建课程</button>}
      >
        {list.length === 0 ? <Empty text="还没有课程，点右上角新建" /> : (
          <div className="course-list">
            {list.map((s) => (
              <div className="course-item" key={s.id}>
                <div className="course-head">
                  <button
                    className="course-thumb"
                    title={s.cover ? '查看封面大图' : '暂无封面'}
                    onClick={() => { if (s.cover) setPreview({ kind: 'cover', sid: s.id, title: s.title, v: s.updatedAt }); }}
                  >
                    {s.cover
                      // 换封面后 updatedAt 变化，拼上版本参数避免浏览器缓存旧图
                      ? <img src={adminApi.coverUrl(s.id) + '&v=' + s.updatedAt} alt={s.title} loading="lazy" />
                      : <span>无封面</span>}
                  </button>
                  <button className="course-toggle" onClick={() => setOpenId(openId === s.id ? '' : s.id)}>
                    {openId === s.id ? '▾' : '▸'} {s.title}
                  </button>
                  <span className="badge">{s.lessonCount} 节</span>
                  <span className="badge">{fmtSize(s.totalSize)}</span>
                  {s.cover ? <span className="badge">{s.coverStorage === 'oss' ? '封面·OSS' : '封面·本地'}</span> : null}
                  <span className="course-time">更新 {fmtTime(s.updatedAt)}</span>
                  <span className="actions">
                    <button className="btn-ghost btn-sm" onClick={() => setDraft({
                      id: s.id, title: s.title, desc: s.desc,
                      teacher: s.teacher, teacherTitle: s.teacherTitle, teacherBio: s.teacherBio,
                      intro: Object.assign({ highlight: '', audience: '', outline: '', gain: '' }, s.intro || {}),
                    })}>编辑</button>
                    <button className="btn-ghost btn-sm" onClick={() => pickCover(s.id)}>{s.cover ? '换封面' : '传封面'}</button>
                    {s.cover ? <button className="btn-ghost btn-sm" onClick={() => removeCover(s)}>移除封面</button> : null}
                    <button className="btn-danger btn-sm" onClick={() => removeSeries(s)}>删除</button>
                  </span>
                </div>

                {openId === s.id ? (
                  <div className="course-body">
                    {s.desc ? <p className="course-desc">{s.desc}</p> : null}
                    {s.teacher ? <p className="course-desc">讲师：{s.teacher}{s.teacherTitle ? `（${s.teacherTitle}）` : ''}</p> : null}
                    <div className="course-ops">
                      <button className="btn-primary btn-sm" disabled={!!upload} onClick={() => pickLesson(s)}>+ 上传视频</button>
                      <span className="hint">支持 mp4 / webm / mov，单个不超过 {fmtSize(storage?.maxSize || 2 * 1024 * 1024 * 1024)}</span>
                    </div>
                    {s.lessonCount === 0 ? <Empty text="还没有课时" /> : (
                      <table className="table">
                        <thead>
                          <tr><th style={{ width: 56 }}>序号</th><th>课时名称</th><th style={{ width: 90 }}>大小</th><th style={{ width: 90 }}>存储</th><th style={{ width: 110 }}>上传时间</th><th style={{ width: 260 }}>操作</th></tr>
                        </thead>
                        <tbody>
                          {s.lessons.map((l, i) => (
                            <tr key={l.id}>
                              <td>{i + 1}</td>
                              <td>{l.title}</td>
                              <td>{fmtSize(l.size)}</td>
                              <td><span className="badge">{l.storage === 'oss' ? 'OSS' : '本地'}</span></td>
                              <td>{fmtTime(l.createdAt)}</td>
                              <td className="actions">
                                <button className="btn-ghost btn-sm" onClick={() => setPreview({ kind: 'video', lessonId: l.id, title: l.title, cover: false })}>预览</button>
                                <button className="btn-ghost btn-sm" onClick={() => renameLesson(l.id, l.title)}>改名</button>
                                <button className="btn-ghost btn-sm" disabled={i === 0} onClick={() => moveLesson(s, i, -1)}>上移</button>
                                <button className="btn-ghost btn-sm" disabled={i === s.lessonCount - 1} onClick={() => moveLesson(s, i, 1)}>下移</button>
                                <button className="btn-danger btn-sm" onClick={() => removeLesson(l.id, l.title)}>删除</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {preview ? (
        <div className="modal-mask" onClick={() => setPreview(null)}>
          <div
            className={'modal preview-modal' + (preview.kind === 'video' ? ' preview-video' : ' preview-cover')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-h">
              <h3>{preview.title}</h3>
              <button className="btn-ghost btn-sm" onClick={() => setPreview(null)}>关闭</button>
            </div>
            <div className="modal-b">
              {preview.kind === 'video' ? (
                <video
                  className="preview-player"
                  controls
                  autoPlay
                  playsInline
                  // 走本服务的 /api/courses/video/:id，由服务端 302 到 OSS 预签名 URL
                  src={adminApi.videoUrl(preview.lessonId)}
                />
              ) : (
                <img
                  className="preview-image"
                  alt={preview.title}
                  src={adminApi.coverUrl(preview.sid) + '&v=' + preview.v}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {draft ? (
        <div className="modal-mask">
          <div className="modal">
            <div className="modal-h">
              <h3>{draft.id ? '编辑课程' : '新建课程'}</h3>
              <button className="btn-ghost btn-sm" onClick={() => setDraft(null)}>关闭</button>
            </div>
            <div className="modal-b">
              <label className="field"><span>课程名称 *</span>
                <input value={draft.title} maxLength={80} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="例如：短线复盘体系" />
              </label>
              <label className="field"><span>课程简介</span>
                <textarea value={draft.desc} maxLength={300} rows={2} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} />
              </label>
              <div className="field-row">
                <label className="field"><span>讲师</span>
                  <input value={draft.teacher} maxLength={40} onChange={(e) => setDraft({ ...draft, teacher: e.target.value })} />
                </label>
                <label className="field"><span>讲师头衔</span>
                  <input value={draft.teacherTitle} maxLength={60} onChange={(e) => setDraft({ ...draft, teacherTitle: e.target.value })} />
                </label>
              </div>
              <label className="field"><span>讲师简介</span>
                <textarea value={draft.teacherBio} maxLength={500} rows={2} onChange={(e) => setDraft({ ...draft, teacherBio: e.target.value })} />
              </label>
              {INTRO_FIELDS.map((f) => (
                <label className="field" key={f.k}><span>{f.label}</span>
                  <textarea rows={2} placeholder={f.ph} value={draft.intro[f.k] || ''} maxLength={600}
                    onChange={(e) => setDraft({ ...draft, intro: { ...draft.intro, [f.k]: e.target.value } })} />
                </label>
              ))}
            </div>
            <div className="modal-f">
              <button className="btn-ghost" onClick={() => setDraft(null)}>取消</button>
              <button className="btn-primary" disabled={busy} onClick={saveSeries}>{busy ? '保存中…' : '保存'}</button>
            </div>
          </div>
        </div>
      ) : null}

      <input ref={fileRef} type="file" accept="video/*" hidden onChange={onLessonFile} />
      <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onCoverFile} />
    </>
  );
}
