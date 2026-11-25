import{x as l,j as a,f as s}from"./index-BU5TSFoR.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=l("Play",[["polygon",{points:"6 3 20 12 6 21 6 3",key:"1oa8hb"}]]);function c({options:t,value:o,onChange:r,label:n}){return a.jsx("div",{role:"radiogroup","aria-label":n,className:"flex flex-wrap gap-2",children:t.map(e=>a.jsx("button",{type:"button",role:"radio","aria-checked":o===e.value,onClick:()=>r(e.value),title:e.hint,className:s("pressable h-9 rounded-full px-3.5 text-footnote font-semibold transition-colors",o===e.value?"bg-primary text-primary-foreground":"bg-secondary text-foreground"),children:e.label},String(e.value)))})}function d({children:t}){return a.jsx("p",{className:"mb-2 text-footnote font-semibold text-muted-foreground",children:t})}export{c as C,d as F,u as P};
