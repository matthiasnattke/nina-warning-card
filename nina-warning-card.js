/* NINA Warning Card – official warnings (German NINA integration) for several places, merged.
   The same warning (same ID) is shown once with all affected places. Colour by severity, icon by type.
   MIT License – see LICENSE */
const NWC_VERSION = '1.0.0';
const NWC_LANG = (h) => { const l = ((h && ((h.locale && h.locale.language) || h.language)) || 'en').slice(0, 2); return l === 'de' ? 'de' : 'en'; };
const NWC_I18N = {
  en: { warning: 'Warning', sev: { minor: 'Minor', moderate: 'Moderate', severe: 'Severe', extreme: 'Extreme' }, from: 'from', until: 'until', today: 'today', tomorrow: 'tomorrow', clock: '', details: 'Details ›', none: (p) => `✅ No official warnings for ${p}` },
  de: { warning: 'Warnung', sev: { minor: 'Hinweis', moderate: 'Markant', severe: 'Unwetter', extreme: 'Extremes Unwetter' }, from: 'ab', until: 'bis', today: 'heute', tomorrow: 'morgen', clock: ' Uhr', details: 'Details ›', none: (p) => `✅ Keine amtlichen Warnungen für ${p}` },
};
// Sensor suffixes of the NINA integration in German and English installations; override with `keys:`.
const NWC_KEYS = {
  head: ['uberschrift', 'headline'], sender: ['absender', 'sender'], sev: ['schweregrad', 'severity'],
  start: ['start'], end: ['lauft_ab', 'expires', 'expiry'], url: ['weitere_informationen_url', 'more_information_url', 'more_info_url', 'web'],
};
const NWC_ATTR = { head: 'headline', sender: 'sender', sev: 'severity', start: 'start', end: 'expires', url: 'web' };
class NinaWarningCard extends HTMLElement {
  static getStubConfig() { return { places: [{ name: 'My town', prefix: '' }] }; }
  setConfig(c) { if (!c || !Array.isArray(c.places) || !c.places.length) throw new Error('places is required'); this._c = c; if (!this.shadowRoot) this.attachShadow({ mode: 'open' }); }
  getCardSize() { return 3; }
  getGridOptions() { return { columns: 'full', rows: 'auto' }; }
  _keys(k) { const o = this._c.keys && this._c.keys[k]; return o ? [].concat(o) : NWC_KEYS[k]; }
  _ents() {
    const a = [];
    this._c.places.forEach((p) => { for (let i = 1; i <= (p.slots || 5); i++) { a.push('binary_sensor.warning_' + p.prefix + '_' + i); Object.keys(NWC_KEYS).forEach((k) => this._keys(k).forEach((s) => a.push('sensor.' + p.prefix + '_' + s + '_' + i))); } });
    return a;
  }
  set hass(h) { this._h = h; const sig = this._ents().map((e) => { const s = h.states[e]; return s ? s.state + (s.attributes.id || '') : '-'; }).join('|') + NWC_LANG(h); if (sig === this._sig) return; this._sig = sig; this._render(); }
  _render() {
    const h = this._h, c = this._c, T = NWC_I18N[NWC_LANG(h)], loc = (h.locale && h.locale.language) || h.language || 'en';
    const S = (e) => h.states[e], ok = (s) => s && !['unknown', 'unavailable', ''].includes(s.state);
    const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
    const W = new Map();
    c.places.forEach((p) => {
      for (let i = 1; i <= (p.slots || 5); i++) {
        const b = S('binary_sensor.warning_' + p.prefix + '_' + i); if (!b || b.state !== 'on') continue;
        const g = (k) => { for (const suf of this._keys(k)) { const s = S('sensor.' + p.prefix + '_' + suf + '_' + i); if (ok(s)) return s.state; } const v = b.attributes[NWC_ATTR[k]]; return v != null && v !== '' ? String(v) : null; };
        const head = g('head') || T.warning, key = b.attributes.id || head;
        if (!W.has(key)) W.set(key, { head, sender: g('sender'), sev: (g('sev') || '').toLowerCase(), start: g('start'), end: g('end'), url: g('url'), places: [] });
        const w = W.get(key); if (!w.places.includes(p.name)) w.places.push(p.name);
      }
    });
    const SEV = { minor: ['#f2c94c', '#3a2f00'], moderate: ['#f2994a', '#3a1f00'], severe: ['#e5484d', '#fff'], extreme: ['#8e3fd6', '#fff'] }, RANK = { extreme: 4, severe: 3, moderate: 2, minor: 1 };
    const KIND = [[/gewitter|thunder/i, '⛈️'], [/sturm|orkan|wind|böen|storm|gust/i, '🌬️'], [/glätte|glatteis|eis|ice|icy/i, '🧊'], [/frost/i, '❄️'], [/schnee|snow/i, '🌨️'], [/regen|rain/i, '🌧️'], [/hitze|heat|uv/i, '🌡️'], [/nebel|fog/i, '🌫️'], [/hochwasser|flut|flood/i, '🌊'], [/brand|feuer|fire/i, '🔥']];
    const icon = (t) => (KIND.find((k) => k[0].test(t)) || [0, '⚠️'])[1];
    const short = (t) => String(t).replace(/^amtliche\s+(unwetter)?warnung\s+vor\s+/i, '').replace(/^(unwetter)?warnung\s+vor\s+/i, '');
    const nice = (t) => { const s = short(t); return s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s; };
    const fmt = (v) => { if (!v) return ''; const d = new Date(v); if (isNaN(d)) return ''; const now = new Date(), same = d.toDateString() === now.toDateString(), tom = new Date(now.getTime() + 864e5).toDateString() === d.toDateString(); return (same ? T.today + ' ' : tom ? T.tomorrow + ' ' : d.toLocaleDateString(loc, { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' ') + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }) + T.clock; };
    const list = [...W.values()].sort((a, b) => (RANK[b.sev] || 0) - (RANK[a.sev] || 0));
    const all = c.places.map((p) => p.name);
    if (!list.length) { this.shadowRoot.innerHTML = c.show_empty ? `<style>ha-card{padding:14px 16px;font-size:15px;color:var(--secondary-text-color)}</style><ha-card>${esc(T.none(all.join(' & ')))}</ha-card>` : ''; this.style.display = c.show_empty ? '' : 'none'; return; }
    this.style.display = '';
    const rows = list.map((w) => {
      const sv = SEV[w.sev] || SEV.moderate, lvl = T.sev[w.sev] || T.sev.moderate, where = w.places.join(' & ');
      const when = [w.start ? T.from + ' ' + fmt(w.start) : '', w.end ? T.until + ' ' + fmt(w.end) : ''].filter(Boolean).join(' · ');
      const url = w.url && /^https?:\/\//i.test(w.url) ? w.url : '';
      return `<div class="w" style="--bg:${sv[0]};--fg:${sv[1]}"><div class="ic">${icon(w.head)}</div><div class="tx"><div class="lv">${esc(lvl)}${w.sender ? ' · ' + esc(w.sender) : ''}</div><div class="hd">${esc(nice(w.head))}</div><div class="pl">📍 ${esc(where)}${when ? ' · ' + esc(when) : ''}</div></div>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener" class="mo">${T.details}</a>` : ''}</div>`;
    }).join('');
    this.shadowRoot.innerHTML = `<style>
ha-card{padding:0;display:flex;flex-direction:column;gap:8px;background:transparent;box-shadow:none;border:none}
.w{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:var(--bg);color:var(--fg);box-shadow:0 2px 10px rgba(0,0,0,.25);position:relative;overflow:hidden}
.w::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.08) 0 10px,transparent 10px 20px);pointer-events:none}
.ic{font-size:34px;line-height:1;flex:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
.tx{flex:1;min-width:0}.lv{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;opacity:.85}
.hd{font-size:20px;font-weight:800;line-height:1.15;margin:1px 0 3px}.pl{font-size:13px;font-weight:600;opacity:.9}
.mo{flex:none;color:var(--fg);font-weight:700;font-size:13px;text-decoration:none;padding:7px 11px;border-radius:10px;background:rgba(0,0,0,.14);position:relative}
</style><ha-card>${rows}</ha-card>`;
  }
}
if (!customElements.get('nina-warning-card')) customElements.define('nina-warning-card', NinaWarningCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'nina-warning-card')) window.customCards.push({ type: 'nina-warning-card', name: 'NINA Warning Card', description: 'Official warnings (NINA) for several places, merged and coloured by severity' });
console.info(`%c NINA-WARNING-CARD %c ${NWC_VERSION} `, 'color:#fff;background:#e5484d;font-weight:700', 'color:#e5484d;background:#fff');
