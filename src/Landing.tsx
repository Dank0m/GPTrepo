import { useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronRight, FileText, Layers3, MoveUpRight, ShieldCheck, SlidersHorizontal } from 'lucide-react';
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
  const [hours, setHours] = useState(40);
  const bufferedHours = hours * 1.2;
  const effectiveRate = 4800 / bufferedHours;
  const profit = 4800 - bufferedHours * 65;
  const margin = Math.round(profit / 4800 * 100);
  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  return <div className="lp-page">
    <a className="lp-skip" href="#lp-main">Skip to content</a>
    <header className="lp-header">
      <a href="/" className="lp-logo" aria-label="Scopebook home"><ScopeMark />scopebook</a>
      <nav className="lp-nav" aria-label="Main navigation">
        <a href="#how-it-works">The product</a><a href="#example">See it in action</a><a href="#pricing">Pricing</a>
      </nav>
      <a className="lp-nav-cta" href="/app">Open workspace <ArrowUpRight size={16}/></a>
    </header>

    <main id="lp-main">
      <section className="lp-hero" aria-labelledby="lp-hero-heading">
        <div className="lp-hero-copy">
          <div className="lp-eyebrow"><span className="lp-status-dot"/>A little structure. A lot less scope creep.</div>
          <h1 id="lp-hero-heading">Good work.<br/>Clear scope.<br/><span>Better margins.</span></h1>
          <p className="lp-hero-description">Profitable projects start with a better scope. Turn your next estimate into a clear proposal—with the numbers and boundaries built in.</p>
          <div className="lp-hero-actions"><a className="lp-button lp-button-dark" href="/app">Build your first proposal <ArrowUpRight size={19}/></a><a className="lp-text-link" href="/app?sample=1">Explore an example <ArrowRight size={17}/></a></div>
          <div className="lp-reassurance"><span><Check size={14}/>Free to start</span><span><Check size={14}/>No account needed</span><span><Check size={14}/>Saved in your browser</span></div>
        </div>

        <div className="lp-hero-art" aria-label="Example proposal for the Riverton design project">
          <div className="lp-art-grid"/>
          <span className="lp-art-label">THE GOOD WORK, IN WRITING.</span>
          <div className="lp-proposal-shadow"/>
          <div className="lp-proposal">
            <div className="lp-proposal-top"><span className="lp-studio"><span className="lp-studio-symbol">l.</span> LUMA STUDIO</span><span className="lp-document-tag">PROJECT PROPOSAL</span></div>
            <div className="lp-proposal-number">PREPARED FOR RIVERTON</div>
            <h2>A fresh identity.<br/>A clear way forward.</h2>
            <p className="lp-proposal-intro">A thoughtful visual identity for your next chapter.</p>
            <div className="lp-proposal-line"/>
            <div className="lp-deliverable"><span><i>01</i>Discovery & direction</span><Check size={14}/></div>
            <div className="lp-deliverable"><span><i>02</i>Visual identity system</span><Check size={14}/></div>
            <div className="lp-deliverable"><span><i>03</i>Brand guidelines & handoff</span><Check size={14}/></div>
            <div className="lp-project-total"><span>PROJECT INVESTMENT<strong>$4,800<span>USD</span></strong></span><span className="lp-revisions"><CheckCheck size={15}/>2 revision rounds<br/><small>Clear scope. Shared expectations.</small></span></div>
            <div className="lp-proposal-bottom"><span>50% deposit to begin</span><span>Made with scopebook ↗</span></div>
          </div>
          <div className="lp-margin-note"><div className="lp-margin-note-icon"><MoveUpRight size={19}/></div><div><span>Room to do your best work.</span><strong>35% estimated margin</strong></div><span className="lp-note-spark"><ScopeBurst/></span></div>
          <div className="lp-scope-note"><span className="lp-scope-note-check"><Check size={12}/></span>Scope creep? Put a price on it.</div>
          <span className="lp-art-caption"><span>01 / A BETTER START</span><ArrowDown size={14}/></span>
        </div>
      </section>

      <div className="lp-principles"><span>BUILT FOR INDEPENDENT WORK</span><div><span>Designers</span><i><ScopeBurst/></i><span>Developers</span><i><ScopeBurst/></i><span>Small studios</span><i><ScopeBurst/></i><span>People who care about their time</span></div></div>

      <section className="lp-workflow lp-section" id="how-it-works" aria-labelledby="lp-workflow-heading">
        <div className="lp-section-heading"><div><span className="lp-section-kicker">FROM “HOW MUCH?” TO “LET’S DO IT.”</span><h2 id="lp-workflow-heading">A proposal that works<br/>as hard as you do.</h2></div><p>You bring the craft. Scopebook brings the structure to price it, protect it, and put it on paper.</p></div>
        <div className="lp-feature-grid">
          <article className="lp-feature"><div className="lp-feature-top"><span className="lp-feature-icon"><SlidersHorizontal size={22} strokeWidth={1.6}/></span><span>01</span></div><h3>Know your numbers.</h3><p>Estimate the work, add a sensible buffer, and see your effective hourly rate. Find out if the project adds up before you say yes.</p><span className="lp-feature-foot">Less guessing. Better pricing.</span></article>
          <article className="lp-feature"><div className="lp-feature-top"><span className="lp-feature-icon lp-feature-icon-lilac"><Layers3 size={22} strokeWidth={1.6}/></span><span>02</span></div><h3>Draw the lines.</h3><p>List what’s included, what isn’t, and how many revisions you’ll do. Turn “one more thing” into a clearly priced change order.</p><span className="lp-feature-foot">Good boundaries, on the page.</span></article>
          <article className="lp-feature"><div className="lp-feature-top"><span className="lp-feature-icon lp-feature-icon-peach"><FileText size={22} strokeWidth={1.6}/></span><span>03</span></div><h3>Make it client-ready.</h3><p>Preview a polished proposal and print it to PDF. The scope, deliverables, and payment terms are all in one place.</p><span className="lp-feature-foot">Ready for the next conversation.</span></article>
        </div>
      </section>

      <section className="lp-example-section" id="example" aria-labelledby="lp-example-heading">
        <div className="lp-example-copy"><span className="lp-section-kicker">THE NUMBER BEHIND THE NUMBER</span><h2 id="lp-example-heading">A $4,800 project.<br/>But is it a good one?</h2><p>A great-looking fee can hide a thin margin. See what happens when your time estimate changes, before the extra hours become a surprise.</p><a className="lp-text-link" href="/app?sample=1">Make this example your own <ArrowUpRight size={17}/></a><a className="lp-text-link lp-sample-download" href="/scopebook-example.pdf" download>Download a sample PDF <FileText size={15}/></a><span className="lp-example-footnote">Illustrative estimate. Margin is calculated against your target hourly rate, before tax and other business costs.</span></div>
        <div className="lp-calculator"><div className="lp-calculator-top"><span><span className="lp-calculator-dot"/>THE QUICK REALITY CHECK</span><span className="lp-live-pill">Try it live</span></div><div className="lp-calculator-project"><span>Riverton · Brand identity</span><strong>$4,800 <small>fixed fee</small></strong></div><div className="lp-hours-row"><label htmlFor="lp-hours">Estimated project hours</label><output htmlFor="lp-hours">{hours}<span>h</span></output></div><input id="lp-hours" className="lp-range" type="range" min="24" max="80" step="2" value={hours} onChange={event=>setHours(Number(event.target.value))} style={{'--lp-progress':`${(hours-24)/56*100}%`} as CSSProperties} aria-describedby="lp-range-help"/><div className="lp-range-labels"><span>24 hours</span><span>80 hours</span></div><p id="lp-range-help" className="lp-calc-assumption">Includes a 20% time buffer · $65/h target rate</p><div className="lp-calculator-results"><div><span>Effective hourly rate</span><strong>{money(effectiveRate)}<small>/h</small></strong></div><div className={margin<0?'lp-calculator-margin lp-margin-low':'lp-calculator-margin'}><span>Estimated margin</span><strong>{margin}<small>%</small></strong></div></div><div className={profit<0?'lp-calc-verdict lp-verdict-low':'lp-calc-verdict'}><span>{profit<0?<ArrowDown size={17}/>:<MoveUpRight size={17}/>}</span><p><strong>{money(Math.abs(profit))}</strong> {profit<0?'below':'above'} your target compensation.</p></div></div>
      </section>

      <section className="lp-pricing lp-section" id="pricing" aria-labelledby="lp-pricing-heading">
        <div className="lp-pricing-heading"><span className="lp-section-kicker">SMALL TOOL. USEFUL BOUNDARIES.</span><h2 id="lp-pricing-heading">Start with one good proposal.</h2><p>Keep it free, or make Scopebook part of your everyday workflow.</p></div>
        <div className="lp-price-grid"><article className="lp-price-card"><div className="lp-price-card-header"><span className="lp-plan-name">THE FIRST STEP</span><h3>Free</h3><p>For your next project.</p></div><div className="lp-price"><strong>$0</strong><span>No card. No signup.</span></div><a className="lp-button lp-button-outline" href="/app">Start free <ArrowUpRight size={18}/></a><ul><li><Check size={16}/>One saved proposal</li><li><Check size={16}/>Project pricing & margin calculator</li><li><Check size={16}/>Scope, revisions & payment terms</li><li><Check size={16}/>Scopebook-branded PDF prints</li></ul></article><article className="lp-price-card lp-price-pro"><div className="lp-price-card-header"><span className="lp-plan-name">FOR YOUR NEXT CHAPTER <span className="lp-one-time">ONE-TIME PAYMENT</span></span><h3>Pro <span><ArrowUpRight size={21}/></span></h3><p>Your workflow, with more room.</p></div><div className="lp-price"><strong>$29</strong><span>{billingReady?'Pay once. No subscription.':'Planned launch price. No subscription.'}</span></div><button className="lp-button lp-button-lime" onClick={onUpgrade} disabled={isPro}>{isPro?'Pro is active':billingReady?'Get Scopebook Pro':'Explore Pro'}{isPro?<Check size={18}/>:<ArrowUpRight size={18}/>}</button><ul><li><Check size={16}/>Up to 500 saved proposals</li><li><Check size={16}/>Clean, client-ready PDF prints</li><li><Check size={16}/>JSON backup & restore</li><li><Check size={16}/>Recovery key to restore Pro access</li></ul>{!billingReady&&!isPro&&<p className="lp-payment-note">Payments aren’t connected yet. The free workspace is ready to use.</p>}</article></div>
      </section>

      <section className="lp-faq lp-section" aria-labelledby="lp-faq-heading"><div><span className="lp-section-kicker">A FEW GOOD QUESTIONS</span><h2 id="lp-faq-heading">Nice and clear.<br/>Like your next scope.</h2><div className="lp-privacy-seal"><ShieldCheck size={22} strokeWidth={1.5}/><span>Your work stays yours.<br/><small>Project data is stored in your browser.</small></span></div></div><div className="lp-faq-list"><details><summary>Is this another subscription?<span>+</span></summary><p>No. The free workspace lets you keep one proposal. Pro is planned as a single $29 payment for up to 500 saved proposals, clean PDF prints, and backups. {billingReady?'Checkout is handled by Stripe.':'Checkout has not been connected yet; you won’t be charged.'}</p></details><details id="privacy"><summary>Where are my proposals stored?<span>+</span></summary><p>In this browser’s local storage. Project details are not uploaded to a Scopebook account. Clearing your browser data or switching browsers won’t carry them with you. Pro includes JSON backup and restore; keep a backup somewhere safe. Payment and license records are handled separately.</p></details><details><summary>Can clients sign or pay through a proposal?<span>+</span></summary><p>Scopebook prepares the proposal and your payment terms. Export a PDF to send through your usual email, signing, or invoicing workflow. Client e-signatures and invoice collection are not built in.</p></details><details><summary>Does the margin estimate include everything?<span>+</span></summary><p>It compares your project fee with estimated hours, a time buffer, and your target hourly rate. It is a planning estimate, before tax, software, subcontractors, and other business costs. Adjust your target rate to reflect how you run your business.</p></details><details><summary>Is the proposal a legal contract?<span>+</span></summary><p>It’s a clear record of your project scope and commercial terms, not legal advice or a substitute for a reviewed contract. Use your own agreement where your project or jurisdiction requires one.</p></details></div></section>

      <section className="lp-final-cta"><div className="lp-final-decoration" aria-hidden="true"><ScopeBurst/></div><div><span className="lp-section-kicker">GOOD WORK DESERVES A GOOD START.</span><h2>Your next project,<br/>on better terms.</h2></div><a className="lp-button lp-button-lime" href="/app">Build your first proposal <ArrowUpRight size={20}/></a></section>
    </main>
    <footer className="lp-footer"><a href="/" className="lp-logo"><ScopeMark small/>scopebook</a><span>A little structure for independent work.</span><div><a href="#privacy">Your data</a><a href="/app">Open workspace <ChevronRight size={14}/></a></div></footer>
  </div>;
}
