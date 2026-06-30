// ====== DATA (in-memory, persisted to localStorage) ======
const OUTLETS = [
  { id:"coastal", name:"Coastal Grill", kind:"Fine Dining" },
  { id:"sky", name:"Sky Lounge", kind:"Bar & Snacks" },
];
const MENU_SEED = {
  coastal: [
    ["Tandoori Prawns","Starters",680],["Burrata Salad","Starters",520],
    ["Butter ChickenF","Mains",720],["Goan Fish Curry","Mains",780],
    ["Paneer Tikka Masala","Mains",580],["Garlic Naan","Breads",90],
    ["Truffle Risotto","Mains",890],["Tiramisu","Desserts",320],
    ["Gulab Jamun","Desserts",220],["Filter Coffee","Beverages",140],
  ],
  sky: [
    ["Margarita Pizza","Pizza",480],["Pepperoni Pizza","Pizza",620],
    ["Chicken Wings","Starters",420],["Loaded Nachos","Starters",380],
    ["Mojito","Cocktails",380],["Old Fashioned","Cocktails",620],
    ["IPA Draft","Beer",360],["Iced Latte","Beverages",260],
    ["Cheesecake","Desserts",290],
  ],
};
const TABLE_SEED = {
  coastal: ["T1","T2","T3","T4","T5","T6","T7","T8"],
  sky: ["B1","B2","B3","B4","B5","B6"],
};

let DB = JSON.parse(localStorage.getItem("tlhotel") || "null");
if (!DB) {
  DB = { menu:{}, tables:{}, orders:[], tickets:[] };
  for (const o of OUTLETS) {
    DB.menu[o.id] = MENU_SEED[o.id].map(([n,c,p],i) => ({id:o.id+"-m"+i, name:n, category:c, price:p, stock:50, available:true}));
    DB.tables[o.id] = TABLE_SEED[o.id].map(l => ({label:l, status:"free", orderId:null, seats:4}));
  }
  save();
}
function save(){ localStorage.setItem("tlhotel", JSON.stringify(DB)); }
function uid(){ return "id-"+Math.random().toString(36).slice(2,9); }
function inr(n){ return "₹" + Math.round(n||0).toLocaleString("en-IN"); }

let currentOutlet = OUTLETS[0].id;
let activeOrder = null;
let activeCheck = null;

// ====== NAV ======
function show(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.getElementById(view).classList.remove("hidden");
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("active", b.dataset.view===view));
  if (view==="waiter") renderTables();
  if (view==="kds") renderKDS();
  if (view==="cashier") renderCashier();
  if (view==="manager") renderManager();
  if (view==="inventory") renderInventory();
}
document.querySelectorAll("#nav button").forEach(b => b.onclick = () => show(b.dataset.view));

// outlet selector
const sel = document.getElementById("outlet");
OUTLETS.forEach(o => { const opt = document.createElement("option"); opt.value=o.id; opt.textContent=o.name; sel.appendChild(opt); });
sel.onchange = () => { currentOutlet = sel.value; show(document.querySelector(".view:not(.hidden)").id); };

// ====== WAITER ======
function renderTables() {
  document.getElementById("orderPanel").classList.add("hidden");
  const div = document.getElementById("tables");
  div.innerHTML = "";
  DB.tables[currentOutlet].forEach(t => {
    const btn = document.createElement("button");
    btn.className = "t-" + t.status;
    btn.innerHTML = `${t.label}<small>${t.status}</small>`;
    btn.onclick = () => openTable(t);
    div.appendChild(btn);
  });
}
function openTable(t) {
  if (!t.orderId) {
    const o = { id:uid(), outlet:currentOutlet, table:t.label, items:[], status:"open" };
    DB.orders.push(o); t.orderId = o.id; t.status = "occupied"; save();
  }
  activeOrder = DB.orders.find(o => o.id === t.orderId);
  document.getElementById("orderPanel").classList.remove("hidden");
  document.getElementById("tblLabel").textContent = t.label;
  renderMenu(); renderOrder();
}
function renderMenu() {
  const div = document.getElementById("menuList");
  div.innerHTML = "";
  DB.menu[currentOutlet].forEach(m => {
    const b = document.createElement("button");
    b.disabled = !m.available || m.stock <= 0;
    b.innerHTML = `<b>${m.name}</b><small>${inr(m.price)}</small><br>Stock: ${m.stock}`;
    b.onclick = () => { activeOrder.items.push({...m, qty:1, status:"draft"}); save(); renderOrder(); };
    div.appendChild(b);
  });
}
function renderOrder() {
  const ul = document.getElementById("orderItems"); ul.innerHTML = "";
  activeOrder.items.forEach(i => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${i.qty}× ${i.name} <small>(${i.status})</small></span><span>${inr(i.price*i.qty)}</span>`;
    ul.appendChild(li);
  });
  const sub = activeOrder.items.reduce((s,i)=>s+i.price*i.qty,0);
  const c = sub*0.025, s = sub*0.025;
  document.getElementById("sub").textContent = inr(sub);
  document.getElementById("cgst").textContent = inr(c);
  document.getElementById("sgst").textContent = inr(s);
  document.getElementById("tot").textContent = inr(sub+c+s);
  activeOrder.subtotal = sub; activeOrder.cgst = c; activeOrder.sgst = s; activeOrder.total = sub+c+s;
}
function fireOrder() {
  const drafts = activeOrder.items.filter(i => i.status === "draft");
  if (!drafts.length) return alert("Nothing to fire");
  DB.tickets.push({ id:uid(), outlet:currentOutlet, orderId:activeOrder.id, table:activeOrder.table,
    items:drafts.map(i=>({name:i.name, qty:i.qty})), createdAt:Date.now(), status:"new" });
  drafts.forEach(i => { i.status = "sent"; const mi = DB.menu[currentOutlet].find(m=>m.id===i.id); if(mi){ mi.stock -= i.qty; if(mi.stock<=0) mi.available=false; } });
  activeOrder.status = "sent";
  const tbl = DB.tables[currentOutlet].find(t=>t.label===activeOrder.table);
  if (tbl) tbl.status = "sent";
  save(); alert("Fired to kitchen!"); renderTables();
}
// ====== KDS ======
function renderKDS() {
  const div = document.getElementById("tickets"); div.innerHTML = "";
  const list = DB.tickets.filter(t => t.outlet===currentOutlet && t.status!=="bumped");
  document.getElementById("ticketCount").textContent = list.length;
  list.forEach(t => {
    const age = (Date.now() - t.createdAt) / 1000;
    const cls = age < 60 ? "tk-new" : age < 300 ? "tk-warn" : "tk-alert";
    const mins = Math.floor(age/60), secs = Math.floor(age%60);
    const card = document.createElement("div");
    card.className = "ticket " + cls;
    card.innerHTML = `<div class="tk-head"><div>Table ${t.table}</div><div class="timer">${mins}:${secs.toString().padStart(2,"0")}</div></div>
      <div class="body">${t.items.map(i=>`<div><b>${i.qty}×</b> ${i.name}</div>`).join("")}</div>
      <div class="actions"><button onclick="bumpTicket('${t.id}')">BUMP ✓</button></div>`;
    div.appendChild(card);
  });
}
function bumpTicket(id) {
  const t = DB.tickets.find(x=>x.id===id); if(!t) return;
  t.status = "bumped"; save(); renderKDS();
}
setInterval(() => { if(!document.getElementById("kds").classList.contains("hidden")) renderKDS(); }, 1000);

// ====== CASHIER ======
function renderCashier() {
  document.getElementById("payPanel").classList.add("hidden");
  const div = document.getElementById("openChecks"); div.innerHTML = "";
  DB.orders.filter(o => o.outlet===currentOutlet && o.status!=="paid").forEach(o => {
    const b = document.createElement("button");
    b.innerHTML = `Table <b>${o.table}</b><br><span class="big">${inr(o.total||0)}</span><br><small>${o.items.length} item(s)</small>`;
    b.onclick = () => openPay(o);
    div.appendChild(b);
  });
}
function openPay(o) {
  activeCheck = o;
  document.getElementById("payPanel").classList.remove("hidden");
  document.getElementById("payTbl").textContent = o.table;
  document.getElementById("payItems").innerHTML = o.items.map(i=>`<li>${i.qty}× ${i.name} <span>${inr(i.price*i.qty)}</span></li>`).join("");
  document.getElementById("payTotal").textContent = inr(o.total);
}

function pay(method) {
  activeCheck.status = "paid"; activeCheck.method = method; activeCheck.paidAt = Date.now();
  const tbl = DB.tables[activeCheck.outlet].find(t=>t.label===activeCheck.table);
  if (tbl) { tbl.status = "free"; tbl.orderId = null; }
  save(); alert("Paid via " + method.toUpperCase()); renderCashier();
}
function showZ() {
  const paid = DB.orders.filter(o=>o.outlet===currentOutlet && o.status==="paid");
  const total = paid.reduce((s,o)=>s+(o.total||0),0);
  const byM = {cash:0,card:0,upi:0};
  paid.forEach(o=>{ byM[o.method||"cash"] += o.total||0; });
  document.getElementById("zContent").innerHTML =
    `<p>Orders: <b>${paid.length}</b></p>
     <p>Total Sales: <b>${inr(total)}</b></p>
      <p>Cash: ${inr(byM.cash)}</p>
     <p>Card: ${inr(byM.card)}</p>
     <p>UPI: ${inr(byM.upi)}</p>`;
  document.getElementById("zModal").classList.remove("hidden");
}

// ====== MANAGER ======
function renderManager() {
  const allPaid = DB.orders.filter(o=>o.status==="paid");
  const total = allPaid.reduce((s,o)=>s+(o.total||0),0);
  const active = DB.tickets.filter(t=>t.status!=="bumped").length;
  document.getElementById("kpis").innerHTML =
    `<div class="kpi"><div class="label">Net Sales</div><div class="val">${inr(total)}</div></div>
     <div class="kpi"><div class="label">Paid Orders</div><div class="val">${allPaid.length}</div></div>
     <div class="kpi"><div class="label">Active Tickets</div><div class="val">${active}</div></div>
     <div class="kpi"><div class="label">Outlets Live</div><div class="val">${OUTLETS.length}</div></div>`;
  document.getElementById("outletStats").innerHTML = OUTLETS.map(o => {
     const sales = DB.orders.filter(x=>x.outlet===o.id && x.status==="paid").reduce((s,x)=>s+(x.total||0),0);
    return `<div class="outlet-card"><div>${o.kind}</div><h3>${o.name}</h3><div class="total">${inr(sales)}</div></div>`;
  }).join("");
} 
// ====== INVENTORY ======
function renderInventory() {
  const tb = document.getElementById("stockBody"); tb.innerHTML = "";
  DB.menu[currentOutlet].forEach(m => {
    const cls = m.stock<=0 ? "oos" : m.stock<=5 ? "low" : "";
    tb.innerHTML += `<tr><td>${m.name}</td><td>${m.category}</td>
    <td class="${cls}">${m.stock}</td>
      <td class="actions-cell">
        <button onclick="adjust('${m.id}',-1)">−</button>
        <button onclick="adjust('${m.id}',1)">+</button>
        <button onclick="adjust('${m.id}',1)">+1</button>
      </td></tr>`;
  });
}
function adjust(id, delta) {
  const m = DB.menu[currentOutlet].find(x=>x.id===id);
  m.stock = Math.max(0, m.stock+delta); m.available = m.stock>0;
  save(); renderInventory();
}

// ====== INIT ======
show("landing");