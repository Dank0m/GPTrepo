import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, CircleHelp, Copy, ExternalLink, FilePlus2, FileText, FolderOpen, LayoutDashboard, Leaf, LockKeyhole, Menu, MoreHorizontal, Plus, Printer, Search, Settings2, ShieldCheck, Sparkles, Trash2, TrendingUp, X } from 'lucide-react';
import Landing from './Landing';
import { useLanguage, LanguageSwitcher } from './i18n';
import { translateError } from './lib/locale';
import { calculateChangeOrder, calculateProposal, createBlankProposal, createProposal, formatMoney, generateProposalHtml, parseBackup, serializeBackup, validateProposal, type LineItem, type Proposal } from './lib/proposals';
import { getDefaultSettings, downloadFile, fileName, loadProposals, loadSettings, saveProposals, saveSettings, type StudioSettings } from './lib/storage';

interface Billing { configured: boolean; pro: boolean; }
type Notice = { text: string; type?: 'error' | 'success' } | null;

function Logo({ small = false }: { small?: boolean }) {
  const { language, t, locale } = useLanguage();
  return <a className={`brand ${small ? 'brand-small' : ''}`} href="/" aria-label={t("Scopebook home")}><span className="brand-symbol"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 6h13v7H12v13H5V6ZM27 26H14v-7h6V6h7v20Z" fill="currentColor"/></svg></span>scopebook</a>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const { language, t, locale } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, textarea, select, [tabindex="0"]') || []);
    focusable()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const items = focusable(); const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-shade" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="icon-button modal-close" aria-label={t("Close dialog")} onClick={onClose}><X size={19}/></button><span className="eyebrow"><Sparkles size={14}/>  {t("A little more room to grow")}</span><h2 id="modal-title">{title}</h2>{children}</div></div>;
}

export default function App() {
  const { language, t, locale } = useLanguage();
  const [billing, setBilling] = useState<Billing>({ configured: false, pro: false });
  const [billingError, setBillingError] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const noticeLanguage = useRef(language);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const showNotice = useCallback((text: string, type: 'error' | 'success' = 'success') => setNotice({ text, type }), []);
  const closeModal = useCallback(() => { setUpgradeOpen(false); setRecoveryKey(''); }, []);
  async function refreshBilling() {
    try {
      const r = await fetch('/api/billing/status', { headers: { 'Accept-Language': language } });
      if (!r.ok) throw new Error(t("Billing unavailable"));
      const data = await r.json();
      setBilling({ configured: data.configured === true, pro: data.pro === true }); setBillingError(false);
    } catch { setBillingError(true); }
  }
  useEffect(() => { void refreshBilling();
    const outcome = new URLSearchParams(location.search).get('upgrade');
    if (outcome === 'success') showNotice(t("Pro is active. Save your recovery key in Settings."));
    if (outcome === 'error') showNotice(t("Payment could not be verified. No Pro access was granted. Contact the seller if you were charged."), 'error');
    if (outcome === 'cancelled' || new URLSearchParams(location.search).get('checkout') === 'cancelled') showNotice(t("Checkout cancelled. Your proposals are still here."));
    if (outcome === 'pending') showNotice(t("Stripe has not confirmed this payment yet. Wait a moment, then revisit your checkout return link. Pro is not active yet."), 'error');
  }, [showNotice]);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(null), 7500); return () => clearTimeout(timer); } }, [notice]);
  useEffect(() => {
    if (noticeLanguage.current !== language) {
      setNotice(null);
      noticeLanguage.current = language;
    }
  }, [language]);
  async function checkout() {
    setBusy(true);
    try {
      const r = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': language }, body: '{}' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || t("Checkout is unavailable. Try again later."));
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error(t("Unexpected checkout destination."));
      location.assign(url.href);
    } catch (e) { showNotice(e instanceof Error ? translateError(e.message, language) : t("Checkout unavailable."), 'error'); }
    finally { setBusy(false); }
  }
  async function restoreLicense() {
    setBusy(true);
    try {
      const r = await fetch('/api/billing/recover', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': language }, body: JSON.stringify({ key: recovery.trim() }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || t("Recovery key could not be verified."));
      await refreshBilling(); closeModal(); setRecovery(''); showNotice(t("Pro restored on this browser."));
    } catch (e) { showNotice(e instanceof Error ? translateError(e.message, language) : t("Recovery unavailable."), 'error'); }
    finally { setBusy(false); }
  }
  async function revealKey() {
    setBusy(true);
    try {
      const r = await fetch('/api/billing/recovery', { headers: { 'Accept-Language': language } }); const data = await r.json();
      if (!r.ok || typeof data.key !== 'string') throw new Error(data.error || t("Could not retrieve your recovery key."));
      setRecoveryKey(data.key); setUpgradeOpen(true);
    } catch (e) { showNotice(e instanceof Error ? translateError(e.message, language) : t("Key unavailable."), 'error'); }
    finally { setBusy(false); }
  }
  return <>
    {location.pathname.startsWith('/app') ? <Workspace pro={billing.pro} onUpgrade={() => setUpgradeOpen(true)} showNotice={showNotice} onRecovery={revealKey}/> : <Landing onUpgrade={() => setUpgradeOpen(true)} billingReady={billing.configured} isPro={billing.pro}/>}
    {notice && <div className={`toast ${notice.type === 'error' ? 'toast-error' : ''}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.type === 'error' ? <CircleHelp size={18}/> : <CheckCircle2 size={18}/>}<span>{notice.text}</span><button aria-label={t("Dismiss notification")} onClick={() => setNotice(null)}><X size={16}/></button></div>}
    {upgradeOpen && <Modal title={billing.pro ? t("Your Pro workspace.") : t("Small price. Better projects.")} onClose={closeModal}>
      {billing.pro ? <><p>{t("You have up to 500 saved proposals, clean exports, and workspace backups.")}</p>{recoveryKey && <div className="recovery-panel"><label htmlFor="recovery-key">{t("Your private recovery key")}</label><input id="recovery-key" value={recoveryKey} readOnly onFocus={e => e.target.select()}/><p>{t("Save this somewhere safe. It restores Pro in another browser. Anyone with this key can use your license.")}</p><button className="button secondary" onClick={() => downloadFile(recoveryKey + '\n', 'scopebook-pro-recovery.txt', 'text/plain')}>{t("Save recovery key")} <ArrowDownToLine size={15}/></button></div>}<button className="button primary" onClick={closeModal}>{t("Back to work")} <ArrowRight size={16}/></button></> : <>
        <div className="price-display">{formatMoney(29, 'USD', language)} <span>{t("one time · no subscription")}</span></div>
        <ul className="feature-list"><li><Check size={16}/>  {t("Up to 500 saved proposals")}</li><li><Check size={16}/>  {t("Client-ready exports without the watermark")}</li><li><Check size={16}/>  {t("Full workspace backup and restore")}</li><li><Check size={16}/>  {t("Recovery key to move Pro between browsers")}</li></ul>
        {billingError ? <div className="info-callout">{t("Billing is unreachable. Your free workspace still works.")} <button className="text-button" onClick={() => void refreshBilling()}>{t("Retry connection")}</button></div> : !billing.configured ? <div className="info-callout"><LockKeyhole size={17}/><span>{t("Purchases are not open yet. The free workspace works now; no payment will be taken.")}</span></div> : <p className="small muted">{t("Secure checkout with Stripe. Your proposals stay on your device.")}</p>}
        <button className="button primary full" disabled={!billing.configured || billingError || busy} onClick={() => void checkout()}>{busy ? t("Working…") : billing.configured ? t("Get Scopebook Pro — $29") : t("Payments coming soon")}<ArrowRight size={17}/></button>
        <div className="restore-license"><label htmlFor="restore-license">{t("Already have Pro? Restore your recovery key.")}</label><div><input id="restore-license" type="password" placeholder={t("Paste your recovery key")} value={recovery} onChange={e => setRecovery(e.target.value)} autoComplete="off" maxLength={200}/><button className="button secondary" disabled={busy || recovery.trim().length < 16} onClick={() => void restoreLicense()}>{t("Restore")}</button></div></div>
      </>}
    </Modal>}
  </>;
}

interface WorkspaceProps { pro: boolean; onUpgrade: () => void; onRecovery: () => void; showNotice: (text: string, type?: 'error' | 'success') => void; }

function Workspace({ pro, onUpgrade, onRecovery, showNotice }: WorkspaceProps) {
  const { language, t, locale } = useLanguage();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [settings, setSettings] = useState<StudioSettings>(() => getDefaultSettings(language));
  const [initialError, setInitialError] = useState('');
  const [selected, setSelected] = useState<Proposal | null>(() => new URLSearchParams(location.search).get('sample') === '1' ? createProposal({ sample: true, language }) : null);
  const [page, setPage] = useState<'proposals' | 'settings'>('proposals');
  const [tab, setTab] = useState<'estimate' | 'scope' | 'preview' | 'changes'>('estimate');
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const saved = loadProposals(); setProposals(saved); setSettings(loadSettings(language));
      const requested = new URLSearchParams(location.search).get('proposal');
      const found = saved.find(p => p.id === requested);
      if (found) setSelected(structuredClone(found));
    }
    catch { setInitialError("Your saved workspace could not be read. We have kept the original data untouched. Export the stored data before clearing browser storage."); }
  }, []);
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) { if (dirty) { e.preventDefault(); e.returnValue = ''; } }
    window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  function change(value: Partial<Proposal>) { setSelected(p => p ? { ...p, ...value, updatedAt: new Date().toISOString() } : p); setDirty(true); }
  function leave(): boolean { return !dirty || window.confirm(t("You have unsaved changes. Leave without saving?")); }
  function navigate(next: 'proposals' | 'settings') { if (!leave()) return; setSelected(null); setDirty(false); setPage(next); setMobileMenu(false); history.replaceState(null, '', '/app'); }
  function open(proposal: Proposal) { if (!leave()) return; setSelected(structuredClone(proposal)); setDirty(false); setPage('proposals'); setTab('estimate'); history.replaceState(null, '', `/app?proposal=${encodeURIComponent(proposal.id)}`); }
  function create(sample = false) {
    if (!leave()) return;
    const next = sample ? createProposal({ sample: true, language }) : { ...createBlankProposal(language), studioName: settings.studioName, studioEmail: settings.studioEmail, hourlyRate: settings.hourlyRate, currency: settings.currency };
    setSelected(next); setDirty(true); setPage('proposals'); setTab('estimate'); setMobileMenu(false); history.replaceState(null, '', sample ? '/app?sample=1' : '/app');
  }
  function persist(next: Proposal[]) {
    if (initialError) { showNotice(t("Recover your existing workspace before saving new data."), 'error'); return false; }
    try { saveProposals(next); setProposals(next); return true; }
    catch { showNotice(t("Could not save. Browser storage is full or disabled. Export this proposal to keep a copy."), 'error'); return false; }
  }
  function save() {
    if (!selected) return;
    if (pro && proposals.length >= 500 && !proposals.some(p => p.id === selected.id)) { showNotice(t("This workspace holds up to 500 saved proposals. Export and archive an older proposal to make room."), 'error'); return; }
    const exists = proposals.some(p => p.id === selected.id);
    if (!exists && proposals.length >= 1 && !pro) { onUpgrade(); return; }
    try {
      const checked = validateProposal(selected);
      const next = exists ? proposals.map(p => p.id === checked.id ? checked : p) : [checked, ...proposals];
      if (persist(next)) { setSelected(checked); setDirty(false); history.replaceState(null, '', `/app?proposal=${encodeURIComponent(checked.id)}`); showNotice(t("Proposal saved on this browser.")); }
    } catch (e) { showNotice(e instanceof Error ? translateError(e.message, language) : t("Please check your proposal fields."), 'error'); }
  }
  function remove(id: string) {
    if (!window.confirm(t("Delete this saved proposal? This cannot be undone."))) return;
    if (persist(proposals.filter(p => p.id !== id))) showNotice(t("Proposal deleted."));
  }
  function duplicate(p: Proposal) {
    if (!pro && proposals.length >= 1) { onUpgrade(); return; }
    if (!leave()) return;
    setSelected({ ...structuredClone(p), id: crypto.randomUUID(), title: t('{title} (copy)', { title: p.title }), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setDirty(true); setPage('proposals'); setTab('estimate');
  }
  function backup() {
    if (!pro) { onUpgrade(); return; }
    downloadFile(serializeBackup(proposals), `scopebook-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json'); showNotice(t("Workspace backup downloaded. Keep it private."));
  }
  async function importBackup(file?: File) {
    if (!file) return;
    if (file.size > 5_000_000) { showNotice(t("Choose a backup smaller than 5 MB."), 'error'); return; }
    try {
      const imported = parseBackup(await file.text());
      if (!imported.length) { showNotice(t("This backup contains no proposals. Nothing was changed."), 'error'); return; }
      const merged = new Map(proposals.map(p => [p.id, p])); imported.forEach(p => merged.set(p.id, p));
      if (!pro && merged.size > 1) { onUpgrade(); return; }
      if (proposals.length && !window.confirm(t("Import this backup? Proposals with matching IDs will be replaced. Other proposals will be kept."))) return;
      if (!leave()) return;
      if (persist([...merged.values()])) { setSelected(null); setDirty(false); showNotice(t(imported.length === 1 ? "{count} proposal imported." : "{count} proposals imported.", { count: imported.length })); }
    } catch (e) { showNotice(e instanceof Error ? translateError(e.message, language) : t("Invalid backup file."), 'error'); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  }
  function print(proposal: Proposal) {
    try {
      validateProposal(proposal);
      const iframe = document.createElement('iframe');
      iframe.title = t("Print proposal"); iframe.className = 'print-frame'; iframe.setAttribute('sandbox', 'allow-same-origin allow-modals');
      iframe.onload = () => { setTimeout(() => { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); setTimeout(() => iframe.remove(), 60000); }, 250); };
      iframe.srcdoc = generateProposalHtml(proposal, { watermark: !pro, language }); document.body.appendChild(iframe);
    } catch (e) { showNotice(e instanceof Error ? translateError(e.message, language) : t("Check your proposal before exporting."), 'error'); }
  }
  const filtered = proposals.filter(p => `${p.title} ${p.clientName} ${p.clientCompany}`.toLowerCase().includes(query.toLowerCase()));
  const currencies = new Set(proposals.map(p => p.currency));
  const pipeline = proposals.reduce((sum, p) => sum + calculateProposal(p).fee, 0);
  const averageMargin = proposals.length ? proposals.reduce((sum, p) => sum + calculateProposal(p).marginPercent, 0) / proposals.length : 0;
  return <div className="workspace">
    <div className="mobile-top"><Logo small/><button className="icon-button" aria-label={t("Toggle navigation")} aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}><Menu size={22}/></button></div>
    {mobileMenu && <button className="sidebar-backdrop" aria-label={t("Close navigation")} onClick={() => setMobileMenu(false)}/>}
    <aside className={`sidebar ${mobileMenu ? 'is-open' : ''}`}><Logo/>
      <div className="studio-switch"><span className="studio-avatar">{(settings.studioName || 'S').slice(0, 1).toUpperCase()}</span><div><strong>{settings.studioName}</strong><small>{t("Independent workspace")}</small></div><span className="tier-pill">{pro ? 'PRO' : t("FREE")}</span></div>
      <span className="nav-label">{t("WORKSPACE")}</span><nav aria-label={t("Workspace navigation")}><button className={page === 'proposals' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('proposals')}><LayoutDashboard size={18}/>  {t("My proposals")} <span>{proposals.length}</span></button><button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('settings')}><Settings2 size={18}/>  {t("Studio settings")}</button></nav>
      <div className="sidebar-guide"><Leaf size={21}/><h3>{t("Less admin.")}<br/>{t("More good work.")}</h3><p>{t("A clear scope is the first step to a healthy project.")}</p><button onClick={() => create(true)}>{t("Explore an example")} <ArrowRight size={14}/></button></div>
      <div className="sidebar-bottom">{!pro ? <div className="upgrade-card"><div><Sparkles size={16}/><strong>{t("Room for your next big thing.")}</strong></div><p>{t("Up to 500 proposals. One small price.")}</p><button className="button primary full" onClick={onUpgrade}>{t("Explore Pro")} <span>{formatMoney(29, 'USD', language)} <ArrowUpRightIcon/></span></button></div> : <div className="pro-active"><ShieldCheck size={18}/><span>{t("Scopebook Pro is active")}</span></div>}<span className="local-note"><span/>  {t("Saved here. Private by default.")}</span></div>
    </aside>
    <main className="workspace-main"><header className="workspace-top"><span><span className="breadcrumb-muted">{t("Workspace")}</span> <span className="slash">/</span> {selected ? t("Proposal editor") : page === 'settings' ? t("Studio settings") : t("My proposals")}</span><div className="workspace-top-actions"><LanguageSwitcher/><a href="/">{t("Product guide")} <ExternalLink size={13}/></a></div></header>
      {initialError && <div className="error-banner" role="alert"><CircleHelp size={20}/><div>{t(initialError)}<button className="text-button" onClick={() => downloadFile(localStorage.getItem('scopebook.proposals.v1') || '', 'scopebook-recovery.json', 'application/json')}>{t("Download original stored data")}</button></div></div>}
      {selected ? <><div className="editor-header"><div><button className="back-button" onClick={() => navigate('proposals')}><ArrowLeft size={15}/>  {t("All proposals")}</button><h1>{selected.title || t("Untitled proposal")}</h1><p><span className={`status-dot ${dirty ? 'unsaved' : ''}`}/>{dirty ? t("Unsaved changes") : proposals.some(p => p.id === selected.id) ? t("Saved on this browser") : t("Example · not saved")} <span className="dot-separator">·</span> {selected.clientCompany || selected.clientName || t("New client")}</p></div><div className="editor-actions"><button className="button secondary" onClick={() => print(selected)}><Printer size={16}/><span>{t("Print / PDF")}</span></button><button className="button primary" onClick={save}><Check size={16}/>  {t("Save proposal")}</button></div></div>
        <div className="editor-tabs" role="tablist" aria-label={t("Proposal sections")}>{(['estimate', 'scope', 'preview', 'changes'] as const).map((section, i) => <button key={section} id={`tab-${section}`} type="button" role="tab" aria-selected={tab === section} aria-controls={`panel-${section}`} tabIndex={tab === section ? 0 : -1} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const opts = ['estimate', 'scope', 'preview', 'changes'] as const; const next = opts[(i + (e.key === 'ArrowRight' ? 1 : 3)) % 4]; setTab(next); document.getElementById(`tab-${next}`)?.focus(); } }} onClick={() => setTab(section)}>{i + 1 < 3 ? <span className="tab-number">0{i + 1}</span> : section === 'preview' ? <FileText size={15}/> : <Plus size={15}/>} {section === 'estimate' ? t("Project & estimate") : section === 'scope' ? t("Scope & terms") : section === 'preview' ? t("Client preview") : t("Extra work")}</button>)}</div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="editor-content">{tab === 'estimate' ? <EstimateEditor proposal={selected} change={change}/> : tab === 'scope' ? <ScopeEditor proposal={selected} change={change}/> : tab === 'preview' ? <div className="preview-section"><div className="preview-toolbar"><span><ShieldCheck size={16}/>  {t("Your internal rates and margin stay private.")}</span><button className="text-button" onClick={() => { try { downloadFile(generateProposalHtml(selected, { watermark: !pro, language }), `${fileName(selected.title)}.html`, 'text/html'); } catch (e) { showNotice(e instanceof Error ? translateError(e.message, language) : t("Check your proposal fields."), 'error'); } }}>{t("Download HTML")} <ArrowDownToLine size={14}/></button></div><ClientPreview proposal={selected} pro={pro}/>{!pro && <p className="small muted centered">{t("Free exports include a small Scopebook watermark.")} <button className="text-button" onClick={onUpgrade}>{t("Go Pro for clean exports")}</button></p>}</div> : <ChangeOrderEditor proposal={selected} onPrint={print}/>}</div>
      </> : page === 'settings' ? <SettingsPage settings={settings} pro={pro} onUpgrade={onUpgrade} onRecovery={onRecovery} onSave={value => { try { saveSettings(value); setSettings(value); showNotice(t("Studio defaults saved. New proposals will use these settings.")); } catch { showNotice(t("Could not save settings. Check browser storage."), 'error'); } }} onBackup={backup} onImport={() => fileInput.current?.click()}/> : <>
        <div className="dashboard-heading"><div><div className="eyebrow">{t("YOUR NEXT CHAPTER")}</div><h1>{t("Good work starts here")}<span>.</span></h1><p>{t("Clear proposals. Healthy margins. Fewer “just one more things.”")}</p></div><button className="button primary" onClick={() => create()}><Plus size={17}/>  {t("New proposal")}</button></div>
        <div className="stat-grid"><article className="stat-card"><span>{t("Saved proposals")} <FileText size={17}/></span><strong>{proposals.length.toString().padStart(2, '0')}</strong><small>{pro ? t("Room for up to 500 proposals") : t('{count} of 1 free proposal used', { count: proposals.length })}</small></article><article className="stat-card"><span>{t("Proposed project fees")} <TrendingUp size={17}/></span><strong>{currencies.size > 1 ? t("Mixed currencies") : formatMoney(pipeline, proposals[0]?.currency || settings.currency, language)}</strong><small>{t("Estimates, not booked revenue")}</small></article><article className="stat-card"><span>{t("Average projected margin")} <Leaf size={17}/></span><strong>{proposals.length ? `${averageMargin.toLocaleString(locale, { maximumFractionDigits: 0 })}%` : '—'}</strong><small>{t("After your time and project buffer")}</small></article></div>
        <div className="proposals-heading"><div><h2>{t("My proposals")} <span className="count-pill">{proposals.length}</span></h2><p>{t("A little structure for your next big idea.")}</p></div><div className="table-tools"><button className="text-button" onClick={backup}><ArrowDownToLine size={14}/>  {t("Backup")} {!pro && <LockKeyhole size={12}/>}</button><button className="text-button" onClick={() => fileInput.current?.click()}>{t("Import")}</button><label className="search-field"><Search size={16}/><span className="sr-only">{t("Search proposals")}</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("Find a proposal…")}/></label></div></div>
        {proposals.length ? <div className="proposal-table"><div className="table-labels"><span>{t("PROJECT / CLIENT")}</span><span>{t("PROJECT FEE")}</span><span>{t("EST. MARGIN")}</span><span>{t("UPDATED")}</span><span/></div>{filtered.length ? filtered.map(p => { const totals = calculateProposal(p); return <div className="proposal-row" key={p.id}><button className="project-cell" onClick={() => open(p)}><span className="project-icon"><FileText size={20}/></span><span><strong>{p.title}</strong><small>{p.clientCompany || p.clientName || t("Client details to add")}</small></span></button><span className="project-fee">{formatMoney(totals.fee, p.currency, language)}</span><span className={`margin-badge ${totals.marginPercent < 20 ? 'low' : ''}`}>{totals.marginPercent.toLocaleString(locale, { maximumFractionDigits: 0 })}%</span><span className="project-date">{new Date(p.updatedAt).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}</span><div className="row-actions"><button className="icon-button" aria-label={t('Duplicate {title}', { title: p.title })} onClick={() => duplicate(p)}><Copy size={15}/></button><button className="icon-button danger" aria-label={t('Delete {title}', { title: p.title })} onClick={() => remove(p.id)}><Trash2 size={15}/></button></div></div>; }) : <div className="empty-search">{t('No proposals match “{query}”.', { query })} <button className="text-button" onClick={() => setQuery('')}>{t("Clear search")}</button></div>}</div> : <div className="empty-state"><div className="empty-illustration"><span/><FileText size={34}/><span/></div><h3>{t("Your next project, on a better footing.")}</h3><p>{t("Turn an idea into a clear scope and a fee that respects your time.")}</p><button className="button primary" onClick={() => create()}>{t("Create your first proposal")} <ArrowRight size={16}/></button><button className="text-button" onClick={() => create(true)}>{t("Or take a look at an example")}</button></div>}
        <div className="bottom-grid"><article className="example-card"><div><span className="eyebrow">{t("A RUNNING START")}</span><h3>{t("Meet your new proposal process.")}</h3><p>{t("A real example, from project estimate to the “what’s included.” Make it yours.")}</p><button className="text-button" onClick={() => create(true)}>{t("Explore the example")} <ArrowRight size={15}/></button></div><div className="mini-document"><span>{t("PROJECT PROPOSAL")}</span><strong>{t("Something")}<br/>{t("worth making.")}</strong><div/><div/><b><span>{t("PROJECT FEE")}</span>{formatMoney(4800, 'USD', language)}</b></div></article><article className="tip-card"><span className="tip-icon"><Leaf size={21}/></span><span className="eyebrow">{t("A SMALL REMINDER")}</span><h3>{t("Your time is part of the price.")}</h3><p>{t("Add a buffer for calls, feedback, and the unexpected. A good estimate leaves you room to do good work.")}</p><span className="tip-rule"/></article></div>
        <footer className="workspace-footer"><span><ShieldCheck size={14}/>  {t("No account. No client data on our servers.")}</span><span>{t("Built for independent minds.")}</span></footer>
      </>}
      <input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" aria-label={t("Import workspace backup")} onChange={e => void importBackup(e.target.files?.[0])}/>
    </main>
  </div>;
}


function ClientPreview({ proposal, pro }: { proposal: Proposal; pro: boolean }) {
  const { language, t, locale } = useLanguage();
  const preview = useMemo(() => {
    try { return { html: generateProposalHtml(proposal, { watermark: !pro, language }), error: '' }; }
    catch (e) { return { html: '', error: e instanceof Error ? translateError(e.message, language) : t("Please check your proposal fields.") }; }
  }, [proposal, pro, language]);
  return preview.error ? <div className="error-banner" role="alert"><CircleHelp size={19}/><span>{t("Preview needs a small fix:")} {preview.error}</span></div> : <iframe className="proposal-preview" title={t("Client proposal preview")} sandbox="allow-same-origin" srcDoc={preview.html}/>;
}

function ArrowUpRightIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" strokeWidth="1.5"/></svg>; }

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function number(value: string, max = 100000) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0; }

function EstimateEditor({ proposal: p, change }: { proposal: Proposal; change: (value: Partial<Proposal>) => void }) {
  const { language, t, locale } = useLanguage();
  const totals = calculateProposal(p);
  function itemChange(id: string, value: Partial<LineItem>) { change({ items: p.items.map(item => item.id === id ? { ...item, ...value } : item) }); }
  return <div className="estimate-layout"><div className="editor-fields"><section className="editor-card"><div className="section-heading"><span className="section-icon"><FolderOpen size={19}/></span><div><h2>{t("The big picture")}</h2><p>{t("The who, what, and why behind the work.")}</p></div></div><Field label={t("Project name")}><input value={p.title} maxLength={160} placeholder={t("e.g. Brand & website for a new chapter")} onChange={e => change({ title: e.target.value })}/></Field><div className="field-grid"><Field label={t("Client name")}><input value={p.clientName} maxLength={160} placeholder={t("Alex Morgan")} onChange={e => change({ clientName: e.target.value })}/></Field><Field label={t("Company")}><input value={p.clientCompany} maxLength={160} placeholder={t("Their company")} onChange={e => change({ clientCompany: e.target.value })}/></Field></div><Field label={t("Client email (optional)")}><input type="email" value={p.clientEmail} maxLength={254} placeholder="alex@example.com" onChange={e => change({ clientEmail: e.target.value })}/></Field><Field label={t("Project overview")}><textarea rows={3} value={p.description} maxLength={5000} placeholder={t("What are we making, and what will it help your client achieve?")} onChange={e => change({ description: e.target.value })}/></Field></section>
      <section className="editor-card"><div className="section-heading"><span className="section-icon"><FileText size={19}/></span><div><h2>{t("Make the work tangible")}</h2><p>{t("Break the project into clear deliverables.")}</p></div><select aria-label={t("Proposal currency")} value={p.currency} onChange={e => change({ currency: e.target.value as Proposal['currency'] })}><option value="USD">USD $</option><option value="EUR">EUR €</option><option value="GBP">GBP £</option></select></div>
        <div className="line-labels"><span>{t("DELIVERABLE")}</span><span>{t("HOURS")}</span><span>{t("RATE / HOUR")}</span><span>{t("TOTAL")}</span><span/></div>
        {p.items.map((item, index) => <div className="line-item" key={item.id}><div className="line-name"><input aria-label={t('Deliverable {number} name', { number: index + 1 })} value={item.name} maxLength={160} placeholder={t("Deliverable name")} onChange={e => itemChange(item.id, { name: e.target.value })}/><input className="line-description" aria-label={t('Deliverable {number} description', { number: index + 1 })} value={item.description} maxLength={1000} placeholder={t("A little detail (optional)")} onChange={e => itemChange(item.id, { description: e.target.value })}/></div><input aria-label={t('Deliverable {number} hours', { number: index + 1 })} type="number" min="0" max="10000" step="0.25" value={item.hours || ''} placeholder="0" onChange={e => itemChange(item.id, { hours: number(e.target.value, 10000) })}/><input aria-label={t('Deliverable {number} rate', { number: index + 1 })} type="number" min="0" max="100000" step="1" value={item.rate || ''} placeholder="0" onChange={e => itemChange(item.id, { rate: number(e.target.value) })}/><strong className="line-total">{formatMoney(item.hours * item.rate, p.currency, language)}</strong><button className="icon-button danger" aria-label={t('Remove deliverable {number}', { number: index + 1 })} onClick={() => change({ items: p.items.filter(i => i.id !== item.id) })}><X size={15}/></button></div>)}
        <button className="text-button add-deliverable" disabled={p.items.length >= 50} onClick={() => change({ items: [...p.items, { id: crypto.randomUUID(), name: '', description: '', hours: 0, rate: 120 }] })}><Plus size={16}/>  {t("Add a deliverable")}</button><div className="estimate-subtotal"><span>{totals.totalHours.toLocaleString(locale)}  {t("estimated hours")}</span><strong>{formatMoney(totals.fee, p.currency, language)}</strong></div>
      </section>
      <section className="editor-card"><div className="section-heading"><span className="section-icon"><ShieldCheck size={19}/></span><div><h2>{t("Give yourself some breathing room")}</h2><p>{t("Internal numbers. Your client won’t see these.")}</p></div></div><div className="field-grid"><Field label={t("Your target hourly pay")} hint={t("Your internal time cost, before profit.")}><div className="input-suffix"><input aria-label={t("Your target hourly pay")} type="number" min="0" max="100000" value={p.hourlyRate || ''} onChange={e => change({ hourlyRate: number(e.target.value) })}/><span>{t("/ hour")}</span></div></Field><Field label={t("Time buffer")} hint={t("Extra capacity for calls, feedback, surprises.")}><div className="input-suffix"><input aria-label={t("Time buffer")} type="number" min="0" max="200" value={p.bufferPercent || ''} onChange={e => change({ bufferPercent: number(e.target.value, 200) })}/><span>%</span></div></Field></div></section>
    </div><aside className="profit-panel"><div className="profit-top"><span className="eyebrow">{t("THE HEALTH CHECK")}</span><span className="internal-pill"><LockKeyhole size={11}/>  {t("Only you")}</span></div><h2>{t("A project that")}<br/>{t("works for you.")}</h2><p>{t("Make sure the numbers feel as good as the idea.")}</p><div className="profit-main"><span>{t("Projected margin")}</span><strong className={totals.marginPercent < 20 ? 'low-margin' : ''}>{totals.marginPercent.toLocaleString(locale, { maximumFractionDigits: 0 })}<span>%</span></strong><div className="margin-meter"><span style={{ width: `${Math.max(0, Math.min(100, totals.marginPercent))}%` }}/></div><small>{!totals.fee ? t("Add deliverables to see your estimate.") : totals.marginPercent < 0 ? t("Your fee does not cover your time budget.") : totals.marginPercent < 20 ? t("A little tight. Revisit your fee or hours.") : t("A little room for a lot of good work.")}</small></div><dl className="profit-breakdown"><div><dt>{t("Project fee")}</dt><dd>{formatMoney(totals.fee, p.currency, language)}</dd></div><div><dt>{t("Time with buffer")}</dt><dd>{totals.bufferedHours.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}  {t("hrs")}</dd></div><div><dt>{t("Your time budget")}</dt><dd>− {formatMoney(totals.capacityCost, p.currency, language)}</dd></div><div className="profit-total"><dt>{t("Above your time budget")}</dt><dd>{formatMoney(totals.profit, p.currency, language)}</dd></div></dl><div className="effective-rate"><TrendingUp size={17}/><div><strong>{formatMoney(totals.effectiveRate, p.currency, language)} <span>{t("/ effective hour")}</span></strong><p>{t("Project fee ÷ hours including buffer")}</p></div></div><p className="profit-disclaimer">{t("Planning estimate. Excludes business overhead, income taxes, and payment fees. Sales tax is never counted as profit.")}</p></aside></div>;
}

function ScopeEditor({ proposal: p, change }: { proposal: Proposal; change: (value: Partial<Proposal>) => void }) {
  const { language, t, locale } = useLanguage();
  return <div className="scope-layout"><section className="editor-card"><div className="section-heading"><span className="section-icon"><CheckCircle2 size={19}/></span><div><h2>{t("Clear is kind")}</h2><p>{t("A shared understanding from day one.")}</p></div></div><Field label={t("What’s included")} hint={t("One item per line. Be specific about quantities and formats.")}><textarea rows={5} value={p.included.join('\n')} maxLength={20000} placeholder={t("5 responsive website pages\nFigma source files\nOne handover call")} onChange={e => change({ included: e.target.value.split('\n').slice(0, 50) })}/></Field><Field label={t("What’s outside the scope")} hint={t("Name the extras before they become assumptions.")}><textarea rows={4} value={p.excluded.join('\n')} maxLength={20000} placeholder={t("Copywriting and photography\nOngoing site maintenance")} onChange={e => change({ excluded: e.target.value.split('\n').slice(0, 50) })}/></Field><div className="field-grid"><Field label={t("Included revision rounds")}><input type="number" min="0" max="100" value={p.revisionRounds} onChange={e => change({ revisionRounds: Math.floor(number(e.target.value, 100)) })}/></Field><Field label={t("Estimated timeline")}><input value={p.timeline} maxLength={500} placeholder={t("4 weeks from deposit and kickoff")} onChange={e => change({ timeline: e.target.value })}/></Field></div><Field label={t("Additional terms & notes")}><textarea rows={4} maxLength={5000} value={p.notes} placeholder={t("How you handle feedback, delays, and any special arrangements.")} onChange={e => change({ notes: e.target.value })}/></Field></section>
      <section className="editor-card terms-card"><div className="section-heading"><span className="section-icon"><Settings2 size={19}/></span><div><h2>{t("The practical details")}</h2><p>{t("Ready for your client to review.")}</p></div></div><Field label={t("Your studio name")}><input value={p.studioName} maxLength={160} onChange={e => change({ studioName: e.target.value })}/></Field><Field label={t("Your studio email")}><input type="email" value={p.studioEmail} maxLength={254} onChange={e => change({ studioEmail: e.target.value })}/></Field><div className="field-grid"><Field label={t("Deposit (%)")}><input type="number" min="0" max="100" value={p.depositPercent} onChange={e => change({ depositPercent: number(e.target.value, 100) })}/></Field><Field label={t("Sales tax (%)")}><input type="number" step="0.01" min="0" max="100" value={p.taxPercent} onChange={e => change({ taxPercent: number(e.target.value, 100) })}/></Field></div><Field label={t("Proposal valid for (days)")}><input type="number" min="1" max="365" value={p.validDays} onChange={e => change({ validDays: Math.max(1, Math.floor(number(e.target.value, 365))) })}/></Field><div className="info-callout"><ShieldCheck size={18}/><span>{t("This is a project proposal, not a signed contract. Review your terms before sending.")}</span></div></section></div>;
}

function ChangeOrderEditor({ proposal: p, onPrint }: { proposal: Proposal; onPrint: (proposal: Proposal) => void }) {
  const { language, t, locale } = useLanguage();
  const [name, setName] = useState(t("Additional project work")); const [description, setDescription] = useState('');
  const [hours, setHours] = useState(4); const [rate, setRate] = useState(p.items[0]?.rate || 120); const [buffer, setBuffer] = useState(20);
  const result = calculateChangeOrder(hours, rate, buffer);
  const valid = name.trim() && description.trim() && hours > 0 && rate > 0;
  function print() {
    const next: Proposal = { ...p, id: crypto.randomUUID(), title: t('Change order: {name}', { name }), description: t('Additional work for “{title}”.\n\n{description}', { title: p.title, description }), items: [{ id: crypto.randomUUID(), name, description: t('{hours} estimated hours + {buffer}% contingency, priced as a fixed additional fee.', { hours: hours.toLocaleString(locale), buffer: buffer.toLocaleString(locale) }), hours: 1, rate: result.fee }], included: [description], excluded: [t("All work outside the additional scope above. Original proposal terms otherwise apply.")], notes: t('Please confirm this additional fee and any schedule changes before work begins. {notes}', { notes: p.notes }), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    onPrint(next);
  }
  return <div className="change-layout"><section className="editor-card"><span className="eyebrow">{t("WHEN THE PROJECT GROWS")}</span><h2>{t("“One more thing” deserves a price.")}</h2><p className="muted">{t("Keep the relationship good and the scope clear. Quote additional work before you start.")}</p><Field label={t("Change order name")}><input value={name} maxLength={120} onChange={e => setName(e.target.value)}/></Field><Field label={t("What’s changing?")}><textarea rows={5} value={description} maxLength={3000} placeholder={t("Describe the new request, deliverables, and any impact on the timeline.")} onChange={e => setDescription(e.target.value)}/></Field><div className="field-grid three"><Field label={t("Additional hours")}><input type="number" min="0" max="10000" step="0.25" value={hours || ''} onChange={e => setHours(number(e.target.value, 10000))}/></Field><Field label={t("Rate / hour")}><input type="number" min="0" max="100000" value={rate || ''} onChange={e => setRate(number(e.target.value))}/></Field><Field label={t("Contingency (%)")}><input type="number" min="0" max="200" value={buffer || ''} onChange={e => setBuffer(number(e.target.value, 200))}/></Field></div><div className="change-fee"><div><span>{t("Additional fixed fee")}</span><strong>{formatMoney(result.fee, p.currency, language)}</strong><small>{t("Before sales tax. Original tax & deposit terms apply.")}</small></div><button className="button primary" disabled={!valid} onClick={print}><Printer size={16}/>  {t("Print change order")}</button></div></section><div className="scope-reminder"><span className="tip-icon"><ShieldCheck size={22}/></span><h3>{t("One simple rule.")}</h3><p>{t("Agree on the extra work and its price in writing before you do it.")}</p><p className="small">{t("This change order is a separate export. Your original proposal stays intact. Save it as a PDF to keep a record.")}</p></div></div>;
}

function SettingsPage({ settings, pro, onSave, onUpgrade, onRecovery, onBackup, onImport }: { settings: StudioSettings; pro: boolean; onSave: (value: StudioSettings) => void; onUpgrade: () => void; onRecovery: () => void; onBackup: () => void; onImport: () => void }) {
  const { language, t, locale } = useLanguage();
  const [value, setValue] = useState(settings);
  return <><div className="dashboard-heading"><div><div className="eyebrow">{t("MAKE IT YOURS")}</div><h1>{t("A home for your studio")}<span>.</span></h1><p>{t("Your defaults, ready for the next project.")}</p></div></div><div className="settings-layout"><form className="editor-card" onSubmit={e => { e.preventDefault(); onSave(value); }}><h2>{t("Studio defaults")}</h2><p className="muted">{t("Applied to new proposals. Existing proposals keep their own details.")}</p><Field label={t("Studio name")}><input value={value.studioName} required maxLength={160} onChange={e => setValue({ ...value, studioName: e.target.value })}/></Field><Field label={t("Contact email")}><input type="email" value={value.studioEmail} maxLength={254} onChange={e => setValue({ ...value, studioEmail: e.target.value })}/></Field><div className="field-grid"><Field label={t("Target hourly pay")}><input type="number" min="0" max="100000" value={value.hourlyRate} onChange={e => setValue({ ...value, hourlyRate: number(e.target.value) })}/></Field><Field label={t("Default currency")}><select value={value.currency} onChange={e => setValue({ ...value, currency: e.target.value as StudioSettings['currency'] })}><option value="USD">{t("USD — US dollar")}</option><option value="EUR">{t("EUR — Euro")}</option><option value="GBP">{t("GBP — Pound sterling")}</option></select></Field></div><button className="button primary" type="submit"><Check size={16}/>  {t("Save defaults")}</button></form><div><section className="editor-card"><div className="section-heading"><ShieldCheck size={21}/><h2>{t("Your data, your device.")}</h2></div><p className="muted">{t("Proposals live in this browser, not on our servers. They won’t automatically sync, and clearing site data will delete them. Exports and backups contain client information — store them privately.")}</p><div className="settings-buttons"><button className="button secondary" onClick={onBackup}><ArrowDownToLine size={16}/>  {t("Back up workspace")} {!pro && <LockKeyhole size={13}/>}</button><button className="button secondary" onClick={onImport}>{t("Import backup")}</button></div></section><section className="editor-card"><div className="section-heading"><Sparkles size={21}/><h2>{pro ? 'Scopebook Pro' : t("A workspace with room to grow")}</h2></div><p className="muted">{pro ? t("Your license is active. Save your recovery key to restore Pro after clearing cookies or moving browsers. Proposal backups are separate.") : t("One saved proposal is free. Pro gives you up to 500 proposals, clean exports, and full workspace backups for $29, once.")}</p><button className="button primary" onClick={pro ? onRecovery : onUpgrade}>{pro ? t("Save my recovery key") : t("Explore Scopebook Pro")}<ArrowRight size={16}/></button>{!pro && <button className="text-button restore-button" onClick={onUpgrade}>{t("Restore an existing Pro license")}</button>}</section></div></div></>;
}
