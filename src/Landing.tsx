import { useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronRight, FileText, Layers3, MoveUpRight, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { LanguageSwitcher, useLanguage } from './i18n';
import './landing.css';

export type LandingProps = {
  onUpgrade: () => void;
  billingReady: boolean;
  isPro: boolean;
};

function ScopeMark({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'lp-mark lp-mark-small' : 'lp-mark'} viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 6h13v7H12v13H5V6Z" fill="currentColor"/><path d="M27 26H14v-7h6V6h7v20Z" fill="currentColor"/></svg>;
}

function ScopeBurst() {
  return <svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 10v80M10 50h80M22 22l56 56M22 78l56-56" stroke="currentColor" strokeWidth="10" strokeLinecap="round"/></svg>;
}

export default function Landing({ onUpgrade, billingReady, isPro }: LandingProps) {
  const { language, t, locale } = useLanguage();
  const [hours, setHours] = useState(40);
  const bufferedHours = hours * 1.2;
  const effectiveRate = 4800 / bufferedHours;
  const profit = 4800 - bufferedHours * 65;
  const margin = Math.round(profit / 4800 * 100);
  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  return <div className="lp-page">
    <a className="lp-skip" href="#lp-main">{t('Skip to content')}</a>
    <header className="lp-header">
      <a href="/" className="lp-logo" aria-label={t('Scopebook home')}><ScopeMark />scopebook</a>
      <nav className="lp-nav" aria-label={t('Main navigation')}>
        <a href="#how-it-works">{t('The product')}</a><a href="#example">{t('See it in action')}</a><a href="#pricing">{t('Pricing')}</a>
      </nav>
      <LanguageSwitcher />
      <a className="lp-nav-cta" href="/app">{t('Open workspace')} <ArrowUpRight size={16}/></a>
    </header>

    <main id="lp-main">
      <section className="lp-hero" aria-labelledby="lp-hero-heading">
        <div className="lp-hero-copy">
          <div className="lp-eyebrow"><span className="lp-status-dot"/>{t('A little structure. A lot less scope creep.')}</div>
          <h1 id="lp-hero-heading">{t('Good work.')}<br/>{t('Clear scope.')}<br/><span>{t('Better margins.')}</span></h1>
          <p className="lp-hero-description">{t('Profitable projects start with a better scope. Turn your next estimate into a clear proposal—with the numbers and boundaries built in.')}</p>
          <div className="lp-hero-actions"><a className="lp-button lp-button-dark" href="/app">{t('Build your first proposal')} <ArrowUpRight size={19}/></a><a className="lp-text-link" href="/app?sample=1">{t('Explore an example')} <ArrowRight size={17}/></a></div>
          <div className="lp-reassurance"><span><Check size={14}/>{t('Free to start')}</span><span><Check size={14}/>{t('No account needed')}</span><span><Check size={14}/>{t('Saved in your browser')}</span></div>
        </div>

        <div className="lp-hero-art" aria-label={t('Example proposal for the Riverton design project')}>
          <div className="lp-art-grid"/>
          <span className="lp-art-label">{t('THE GOOD WORK, IN WRITING.')}</span>
          <div className="lp-proposal-shadow"/>
          <div className="lp-proposal">
            <div className="lp-proposal-top"><span className="lp-studio"><span className="lp-studio-symbol">l.</span> LUMA STUDIO</span><span className="lp-document-tag">{t('PROJECT PROPOSAL')}</span></div>
            <div className="lp-proposal-number">{t('PREPARED FOR RIVERTON')}</div>
            <h2>{t('A fresh identity.')}<br/>{t('A clear way forward.')}</h2>
            <p className="lp-proposal-intro">{t('A thoughtful visual identity for your next chapter.')}</p>
            <div className="lp-proposal-line"/>
            <div className="lp-deliverable"><span><i>01</i>{t('Discovery & direction')}</span><Check size={14}/></div>
            <div className="lp-deliverable"><span><i>02</i>{t('Visual identity system')}</span><Check size={14}/></div>
            <div className="lp-deliverable"><span><i>03</i>{t('Brand guidelines & handoff')}</span><Check size={14}/></div>
            <div className="lp-project-total"><span>{t('PROJECT INVESTMENT')}<strong>{money(4800)}<span>USD</span></strong></span><span className="lp-revisions"><CheckCheck size={15}/>{t('2 revision rounds')}<br/><small>{t('Clear scope. Shared expectations.')}</small></span></div>
            <div className="lp-proposal-bottom"><span>{t('50% deposit to begin')}</span><span>{t('Made with scopebook')} ↗</span></div>
          </div>
          <div className="lp-margin-note"><div className="lp-margin-note-icon"><MoveUpRight size={19}/></div><div><span>{t('Room to do your best work.')}</span><strong>{t('35% estimated margin')}</strong></div><span className="lp-note-spark"><ScopeBurst/></span></div>
          <div className="lp-scope-note"><span className="lp-scope-note-check"><Check size={12}/></span>{t('Scope creep? Put a price on it.')}</div>
          <span className="lp-art-caption"><span>{t('01 / A BETTER START')}</span><ArrowDown size={14}/></span>
        </div>
      </section>

      <div className="lp-principles"><span>{t('BUILT FOR INDEPENDENT WORK')}</span><div><span>{t('Designers')}</span><i><ScopeBurst/></i><span>{t('Developers')}</span><i><ScopeBurst/></i><span>{t('Small studios')}</span><i><ScopeBurst/></i><span>{t('People who care about their time')}</span></div></div>

      <section className="lp-workflow lp-section" id="how-it-works" aria-labelledby="lp-workflow-heading">
        <div className="lp-section-heading"><div><span className="lp-section-kicker">{t('FROM “HOW MUCH?” TO “LET’S DO IT.”')}</span><h2 id="lp-workflow-heading">{t('A proposal that works')}<br/>{t('as hard as you do.')}</h2></div><p>{t('You bring the craft. Scopebook brings the structure to price it, protect it, and put it on paper.')}</p></div>
        <div className="lp-feature-grid">
          <article className="lp-feature"><div className="lp-feature-top"><span className="lp-feature-icon"><SlidersHorizontal size={22} strokeWidth={1.6}/></span><span>01</span></div><h3>{t('Know your numbers.')}</h3><p>{t('Estimate the work, add a sensible buffer, and see your effective hourly rate. Find out if the project adds up before you say yes.')}</p><span className="lp-feature-foot">{t('Less guessing. Better pricing.')}</span></article>
          <article className="lp-feature"><div className="lp-feature-top"><span className="lp-feature-icon lp-feature-icon-lilac"><Layers3 size={22} strokeWidth={1.6}/></span><span>02</span></div><h3>{t('Draw the lines.')}</h3><p>{t('List what’s included, what isn’t, and how many revisions you’ll do. Turn “one more thing” into a clearly priced change order.')}</p><span className="lp-feature-foot">{t('Good boundaries, on the page.')}</span></article>
          <article className="lp-feature"><div className="lp-feature-top"><span className="lp-feature-icon lp-feature-icon-peach"><FileText size={22} strokeWidth={1.6}/></span><span>03</span></div><h3>{t('Make it client-ready.')}</h3><p>{t('Preview a polished proposal and print it to PDF. The scope, deliverables, and payment terms are all in one place.')}</p><span className="lp-feature-foot">{t('Ready for the next conversation.')}</span></article>
        </div>
      </section>

      <section className="lp-example-section" id="example" aria-labelledby="lp-example-heading">
        <div className="lp-example-copy"><span className="lp-section-kicker">{t('THE NUMBER BEHIND THE NUMBER')}</span><h2 id="lp-example-heading">{t('A {price} project.', { price: money(4800) })}<br/>{t('But is it a good one?')}</h2><p>{t('A great-looking fee can hide a thin margin. See what happens when your time estimate changes, before the extra hours become a surprise.')}</p><a className="lp-text-link" href="/app?sample=1">{t('Make this example your own')} <ArrowUpRight size={17}/></a><a className="lp-text-link lp-sample-download" href={`/scopebook-example-${language}.pdf`} download>{t('Download a sample PDF')} <FileText size={15}/></a><span className="lp-example-footnote">{t('Illustrative estimate. Margin is calculated against your target hourly rate, before tax and other business costs.')}</span></div>
        <div className="lp-calculator">
          <div className="lp-calculator-top"><span><span className="lp-calculator-dot"/>{t('THE QUICK REALITY CHECK')}</span><span className="lp-live-pill">{t('Try it live')}</span></div>
          <div className="lp-calculator-project"><span>{t('Riverton · Brand identity')}</span><strong>{money(4800)} <small>{t('fixed fee')}</small></strong></div>
          <div className="lp-hours-row"><label htmlFor="lp-hours">{t('Estimated project hours')}</label><output htmlFor="lp-hours">{hours}<span>{t('h')}</span></output></div>
          <input id="lp-hours" className="lp-range" type="range" min="24" max="80" step="2" value={hours} onChange={event=>setHours(Number(event.target.value))} style={{'--lp-progress':`${(hours-24)/56*100}%`} as CSSProperties} aria-describedby="lp-range-help"/>
          <div className="lp-range-labels"><span>{t('{hours} hours', { hours: 24 })}</span><span>{t('{hours} hours', { hours: 80 })}</span></div>
          <p id="lp-range-help" className="lp-calc-assumption">{t('Includes a 20% time buffer · {rate}/h target rate', { rate: money(65) })}</p>
          <div className="lp-calculator-results"><div><span>{t('Effective hourly rate')}</span><strong>{money(effectiveRate)}<small>{t('/h')}</small></strong></div><div className={margin<0?'lp-calculator-margin lp-margin-low':'lp-calculator-margin'}><span>{t('Estimated margin')}</span><strong>{margin}<small>%</small></strong></div></div>
          <div className={profit<0?'lp-calc-verdict lp-verdict-low':'lp-calc-verdict'}><span>{profit<0?<ArrowDown size={17}/>:<MoveUpRight size={17}/>}</span><p><strong>{money(Math.abs(profit))}</strong> {profit<0?t('below your target compensation.'):t('above your target compensation.')}</p></div>
        </div>
      </section>

      <section className="lp-pricing lp-section" id="pricing" aria-labelledby="lp-pricing-heading">
        <div className="lp-pricing-heading"><span className="lp-section-kicker">{t('SMALL TOOL. USEFUL BOUNDARIES.')}</span><h2 id="lp-pricing-heading">{t('Start with one good proposal.')}</h2><p>{t('Keep it free, or make Scopebook part of your everyday workflow.')}</p></div>
        <div className="lp-price-grid">
          <article className="lp-price-card"><div className="lp-price-card-header"><span className="lp-plan-name">{t('THE FIRST STEP')}</span><h3>{t('Free')}</h3><p>{t('For your next project.')}</p></div><div className="lp-price"><strong>{money(0)}</strong><span>{t('No card. No signup.')}</span></div><a className="lp-button lp-button-outline" href="/app">{t('Start free')} <ArrowUpRight size={18}/></a><ul><li><Check size={16}/>{t('One saved proposal')}</li><li><Check size={16}/>{t('Project pricing & margin calculator')}</li><li><Check size={16}/>{t('Scope, revisions & payment terms')}</li><li><Check size={16}/>{t('Scopebook-branded PDF prints')}</li></ul></article>
          <article className="lp-price-card lp-price-pro"><div className="lp-price-card-header"><span className="lp-plan-name">{t('FOR YOUR NEXT CHAPTER')} <span className="lp-one-time">{t('ONE-TIME PAYMENT')}</span></span><h3>Pro <span><ArrowUpRight size={21}/></span></h3><p>{t('Your workflow, with more room.')}</p></div><div className="lp-price"><strong>{money(29)}</strong><span>{billingReady?t('Pay once. No subscription.'):t('Planned launch price. No subscription.')}</span></div><button className="lp-button lp-button-lime" onClick={onUpgrade} disabled={isPro}>{isPro?t('Pro is active'):billingReady?t('Get Scopebook Pro'):t('Explore Pro')}{isPro?<Check size={18}/>:<ArrowUpRight size={18}/>}</button><ul><li><Check size={16}/>{t('Up to 500 saved proposals')}</li><li><Check size={16}/>{t('Clean, client-ready PDF prints')}</li><li><Check size={16}/>{t('JSON backup & restore')}</li><li><Check size={16}/>{t('Recovery key to restore Pro access')}</li></ul>{!billingReady&&!isPro&&<p className="lp-payment-note">{t('Payments aren’t connected yet. The free workspace is ready to use.')}</p>}</article>
        </div>
      </section>

      <section className="lp-faq lp-section" aria-labelledby="lp-faq-heading">
        <div><span className="lp-section-kicker">{t('A FEW GOOD QUESTIONS')}</span><h2 id="lp-faq-heading">{t('Nice and clear.')}<br/>{t('Like your next scope.')}</h2><div className="lp-privacy-seal"><ShieldCheck size={22} strokeWidth={1.5}/><span>{t('Your work stays yours.')}<br/><small>{t('Project data is stored in your browser.')}</small></span></div></div>
        <div className="lp-faq-list">
          <details><summary>{t('Is this another subscription?')}<span>+</span></summary><p>{t('No. The free workspace lets you keep one proposal. Pro is planned as a single {price} payment for up to 500 saved proposals, clean PDF prints, and backups.', { price: money(29) })} {billingReady?t('Checkout is handled by Stripe.'):t('Checkout has not been connected yet; you won’t be charged.')}</p></details>
          <details id="privacy"><summary>{t('Where are my proposals stored?')}<span>+</span></summary><p>{t('In this browser’s local storage. Project details are not uploaded to a Scopebook account. Clearing your browser data or switching browsers won’t carry them with you. Pro includes JSON backup and restore; keep a backup somewhere safe. Payment and license records are handled separately.')}</p></details>
          <details><summary>{t('Can clients sign or pay through a proposal?')}<span>+</span></summary><p>{t('Scopebook prepares the proposal and your payment terms. Export a PDF to send through your usual email, signing, or invoicing workflow. Client e-signatures and invoice collection are not built in.')}</p></details>
          <details><summary>{t('Does the margin estimate include everything?')}<span>+</span></summary><p>{t('It compares your project fee with estimated hours, a time buffer, and your target hourly rate. It is a planning estimate, before tax, software, subcontractors, and other business costs. Adjust your target rate to reflect how you run your business.')}</p></details>
          <details><summary>{t('Is the proposal a legal contract?')}<span>+</span></summary><p>{t('It’s a clear record of your project scope and commercial terms, not legal advice or a substitute for a reviewed contract. Use your own agreement where your project or jurisdiction requires one.')}</p></details>
        </div>
      </section>

      <section className="lp-final-cta"><div className="lp-final-decoration" aria-hidden="true"><ScopeBurst/></div><div><span className="lp-section-kicker">{t('GOOD WORK DESERVES A GOOD START.')}</span><h2>{t('Your next project,')}<br/>{t('on better terms.')}</h2></div><a className="lp-button lp-button-lime" href="/app">{t('Build your first proposal')} <ArrowUpRight size={20}/></a></section>
    </main>
    <footer className="lp-footer"><a href="/" className="lp-logo"><ScopeMark small/>scopebook</a><span>{t('A little structure for independent work.')}</span><div><a href="#privacy">{t('Your data')}</a><a href="/app">{t('Open workspace')} <ChevronRight size={14}/></a></div></footer>
  </div>;
}
