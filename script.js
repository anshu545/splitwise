let editIndex = null;
let previewExpenses = [];
let people=JSON.parse(localStorage.getItem("people"))||[];
let expenses=JSON.parse(localStorage.getItem("expenses"))||[];
let settled=JSON.parse(localStorage.getItem("settled"))||{};

function save(){
  localStorage.setItem("people", JSON.stringify(people));
  localStorage.setItem("expenses", JSON.stringify(expenses));
  localStorage.setItem("settled", JSON.stringify(settled));

  const status = document.getElementById("saveStatus");
  if(status){
    status.innerText = "✅ Saved at " + new Date().toLocaleTimeString();
  }
}

let currencyConfig = JSON.parse(localStorage.getItem("currencyConfig")) || {
  enabled: false,
  currency: "",
  rate: 1
};

function saveCurrencyConfig(){
  localStorage.setItem("currencyConfig", JSON.stringify(currencyConfig));
}

function addPerson(){
let name=document.getElementById("personName").value.trim();
if(!name)return;
if(!people.includes(name)) people.push(name);
save();render();
}

function removePerson(i){
people.splice(i,1);
save();render();
}

//Function to add graphs
//SHARE % (based on splits)
function calcSharePercent(){
  let shareTotals = {};
  let total = 0;

  people.forEach(p => shareTotals[p] = 0);

  expenses.forEach(e => {
    for(let p in e.splits){
      shareTotals[p] += e.splits[p];
      total += e.splits[p];
    }
  });

  let percentages = {};

  for(let p in shareTotals){
    percentages[p] = total > 0
      ? (shareTotals[p] / total) * 100
      : 0;
  }

  return percentages;
}


function selectAll(state){
  document.querySelectorAll(".expense-check").forEach(cb => {
    cb.checked = state;
  });

  updateTotals();
}

//SPENT % (based on payer)
function calcSpentPercent(){
  let spentTotals = {};
  let total = 0;

  people.forEach(p => spentTotals[p] = 0);

  expenses.forEach(e => {
    spentTotals[e.payer] += e.amt;
    total += e.amt;
  });

  let percentages = {};

  for(let p in spentTotals){
    percentages[p] = total > 0
      ? (spentTotals[p] / total) * 100
      : 0;
  }

  return percentages;
}

//CHART RENDER FUNCTION
let shareChart = null;
let spentChart = null;

function renderCharts(){

  const colors = [
    "#2563eb", "#16a34a", "#f59e0b",
    "#dc2626", "#7c3aed", "#0891b2"
  ];

  // ✅ SHARE
  let shareData = calcSharePercent();

  if(shareChart) shareChart.destroy();

  shareChart = new Chart(document.getElementById("shareChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(shareData),
      datasets: [{
        data: Object.values(shareData),
        backgroundColor: colors
      }]
    },
    options: {
      cutout: "72%",
      plugins: {
        legend: { position: "right" }
      }
    }
  });

  // ✅ SPENT
  let spentData = calcSpentPercent();

  if(spentChart) spentChart.destroy();

  spentChart = new Chart(document.getElementById("spentChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(spentData),
      datasets: [{
        data: Object.values(spentData),
        backgroundColor: colors
      }]
    },
    options: {
      cutout: "72%",
      plugins: {
        legend: { position: "right" }
      }
    }
  });
}

//“WHO OWES MOST” INSIGHTS
function renderInsights(){

  let bal = calcBalances();
  let overUnder = calcOverUnder();

  let insightsHTML = `<div class="card"><b>⚠️ Insights</b><br><br>`;

  // ✅ who owes most / gets most
  let maxDebt = {name:null, value:0};
  let maxPaid = {name:null, value:0};

  for(let p in bal){
    if(bal[p] < maxDebt.value){
      maxDebt = {name:p, value:bal[p]};
    }
    if(bal[p] > maxPaid.value){
      maxPaid = {name:p, value:bal[p]};
    }
  }

  if(maxDebt.name){
    insightsHTML += `🔴 <b>${maxDebt.name}</b> owes the most (₹${Math.abs(maxDebt.value).toFixed(2)})<br>`;
  }

  if(maxPaid.name){
    insightsHTML += `🟢 <b>${maxPaid.name}</b> should receive the most (₹${maxPaid.value.toFixed(2)})<br>`;
  }

  insightsHTML += `<br><b>📊 Overpaid / Underpaid</b><br>`;

  for(let p in overUnder){
    let d = overUnder[p];

    let color = d.diff >= 0 ? "green" : "red";
    let label = d.diff >= 0 ? "Overpaid" : "Underpaid";

    insightsHTML += `
      <div class="${color}">
        ${p}: ₹${Math.abs(d.diff).toFixed(2)} (${label})
      </div>
    `;
  }
  insightsHTML += `</div>`;
  document.getElementById("insightsBox").innerHTML = insightsHTML;
}

//% DIFFERENCE (OVERPAID vs UNDERPAID)
function calcOverUnder(){

  let spent = {};
  let share = {};

  people.forEach(p => {
    spent[p] = 0;
    share[p] = 0;
  });

  expenses.forEach(e => {

    // spent
    spent[e.payer] += e.amt;

    // share
    for(let p in e.splits){
      share[p] += e.splits[p];
    }
  });

  let result = {};

  for(let p in spent){
    let diff = spent[p] - share[p];

    result[p] = {
      spent: spent[p],
      share: share[p],
      diff: diff
    };
  }

  return result;
}


//ADD TOGGLE FUNCTION
function switchChart(type){
  currentChartType = type;

  // ✅ update button styles
  document.getElementById("btnShare").style.background =
    type === "share" ? "#2563eb" : "#6b7280";

  document.getElementById("btnSpent").style.background =
    type === "spent" ? "#16a34a" : "#6b7280";

  renderShareChart();
}


function addExpense(){
  let desc = document.getElementById("desc").value;
  let originalAmount = parseFloat(document.getElementById("amount").value);
  let payer = document.getElementById("payer").value;
  let date = document.getElementById("date").value;
  let type = document.getElementById("splitType").value;
 
  let selected = [...document.querySelectorAll("#participants .participant-chip.active")].map(x => x.dataset.name);
  let values = document.getElementById("splitValues").value.split(",").map(Number);

  if(!originalAmount || !payer || !selected.length) return;

  // ✅ Currency handling
  
  let currencyEnabled = document.getElementById("enableCurrency").checked;
  let currency = document.getElementById("currencyName").value || "INR";
  let rate = parseFloat(document.getElementById("exchangeRate").value) || 1;

  let amtINR = currencyEnabled ? originalAmount * rate : originalAmount;

  let splits = {};

  // ✅ Use INR amount for splitting
  if(type === "equal"){
    let share = amtINR / selected.length;
    selected.forEach(p => splits[p] = share);
  } else if(type === "exact"){
    selected.forEach((p,i) => splits[p] = values[i] || 0);
  } else {
    selected.forEach((p,i) => splits[p] = (values[i] || 0)/100 * amtINR);
  }

  expenses.push({
    desc,
    amt: amtINR,                 // ✅ store INR
    originalAmount: originalAmount,
    currency: currencyEnabled ? currency : null,
    rate: currencyEnabled ? rate : null,   // ✅ ADD THIS
    payer,
    date,
    splits
  });

  save();
  render();
}

function deleteExpense(i){
expenses.splice(i,1);
save();render();
}

//Save Button
function saveNow(){
  save();
  alert("✅ Data saved successfully!");
}


function editExpense(i){
  let e = expenses[i];
  editIndex = i;

  document.getElementById("editDesc").value = e.desc;
  document.getElementById("editOriginalAmount").value = e.originalAmount;
  document.getElementById("editCurrency").value = e.currency || "";
  document.getElementById("editRate").value = 1; // default
  document.getElementById("editDate").value = e.date || "";

  // ✅ populate payer dropdown
  document.getElementById("editPayer").innerHTML =
    people.map(p => `<option value="${p}" ${p===e.payer?"selected":""}>${p}</option>`).join("");

  // ✅ participants (checkboxes)  
    document.getElementById("editParticipants").innerHTML = people.map(p => `
    <div class="participant-chip ${e.splits[p] ? "active" : ""}"
         onclick="toggleParticipant(this)"
         data-name="${p}">
      ${p}
    </div>
  `).join("");
  document.getElementById("editModal").style.display = "block";
}


function saveEdit(){
  const desc = document.getElementById("editDesc").value.trim();
  const originalAmount = parseFloat(document.getElementById("editOriginalAmount").value) || 0;
  const currency = document.getElementById("editCurrency").value.trim();
  const rate = parseFloat(document.getElementById("editRate").value) || 1;
  const payer = document.getElementById("editPayer").value;
  const date = document.getElementById("editDate").value;

  const selected = [...document.querySelectorAll("#editParticipants .participant-chip.active")].map(x => x.dataset.name);


  if(!desc || !payer || !selected.length){
    alert("Fill all required fields");
    return;
  }

  // ✅ AUTO INR calculation
  const amt = currency ? originalAmount * rate : originalAmount;

  // ✅ Equal split automatically
  let splits = {};
  let share = amt / selected.length;

  selected.forEach(p => {
    splits[p] = share;
  });

  expenses[editIndex] = {
    desc,
    originalAmount,
    currency: currency || null,
    rate: currency ? rate : null,   // ✅ ADD THIS
    amt,
    payer,
    date,
    splits
  };

  save();
  render();
  closeModal();
}

function closeModal(){
  document.getElementById("editModal").style.display = "none";
}

function settlePerson(name){
settled[name]=true;
save();render();
}

function calcBalances(){
let bal={};
people.forEach(p=>bal[p]=0);

expenses.forEach(e=>{
for(let p in e.splits) bal[p]-=e.splits[p];
bal[e.payer]+=e.amt;
});

for(let p in settled){
if(settled[p]) settled[p] = {
 date: new Date(),
 amount: bal[p]
}
}

return bal;
}

function loadCSV(event){
  const file = event.target.files[0];
  if(!file) return;

  const reader = new FileReader();

  reader.onload = function(e){
    const text = e.target.result.trim();

    const rows = text.split("\n").filter(r => r.trim());

    if(rows.length <= 1){
      alert("Invalid CSV");
      return;
    }

    previewExpenses = [];

    for(let i = 1; i < rows.length; i++){

      let row = rows[i];

      // ✅ SAFE CSV SPLIT (supports quotes)
      let parts = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);

      if(!parts || parts.length < 8){
        console.warn("Skipping bad row:", row);
        continue;
      }

      // ✅ CLEAN VALUES
      const desc = parts[0]?.replace(/(^"|"$)/g, "");

      const originalAmount = parseFloat(parts[1]) || 0;

      const currencyRaw = parts[2]?.replace(/(^"|"$)/g, "");
      const currency = currencyRaw && currencyRaw !== "null" ? currencyRaw : null;

      const rate = parseFloat(parts[3]) || null;

      const amt = parseFloat(parts[4]) || 0;

      const payer = parts[5]?.replace(/(^"|"$)/g, "") || "";

      const date = parts[6]?.replace(/(^"|"$)/g, "") || "";

      let splits = {};
      try{
        let splitStr = parts[7].replace(/(^"|"$)/g, "").replace(/""/g, '"');
        splits = JSON.parse(splitStr);
      }catch(e){
        console.warn("Invalid splits:", parts[7]);
      }

      previewExpenses.push({
        desc,
        originalAmount,
        currency,
        rate,
        amt,
        payer,
        date,
        splits
      });
    }

    showPreview();
  };

  reader.readAsText(file);
}




function showPreview(){
  const table = document.getElementById("previewTable");
  table.innerHTML = "";

  previewExpenses.forEach(e => {
    table.innerHTML += `
      <tr>
        <td class="tdo">${e.desc}</td>
        <td class="tdo">₹${e.amt.toFixed(2)}</td>
        <td class="tdo">${e.payer}</td>
        <td class="tdo">${Object.keys(e.splits).join(", ")}</td>
      </tr>
    `;
  });

  document.getElementById("previewBox").style.display = "block";
}



function confirmImport(){
  expenses = previewExpenses;

  // ✅ rebuild people correctly
  let peopleSet = new Set();

  expenses.forEach(e => {
    if(e.payer) peopleSet.add(e.payer);

    if(e.splits){
      Object.keys(e.splits).forEach(p => {
        if(p) peopleSet.add(p);
      });
    }
  });

  people = Array.from(peopleSet);

  save();
  render();

  document.getElementById("previewBox").style.display = "none";

  alert("✅ Import successful!");
}


function cancelImport(){
  previewExpenses = [];
  document.getElementById("previewBox").style.display = "none";
}


function getSettlementBreakdown(bal){
  let debtors = [];
  let creditors = [];

  for(let p in bal){
    if(settled[p]) continue; // skip settled people

    if(bal[p] < 0){
      debtors.push({name:p, amount: -bal[p]}); // owes
    } else if(bal[p] > 0){
      creditors.push({name:p, amount: bal[p]}); // should receive
    }
  }

  let settlements = [];

  let i = 0, j = 0;

  while(i < debtors.length && j < creditors.length){
    let d = debtors[i];
    let c = creditors[j];

    let payAmount = Math.min(d.amount, c.amount);

    settlements.push(`${d.name} ➝ Pays ₹${payAmount.toFixed(2)} to ${c.name}`);

    d.amount -= payAmount;
    c.amount -= payAmount;

    if(d.amount === 0) i++;
    if(c.amount === 0) j++;
  }

  return settlements;
}

function updateTotals(){

  let checkboxes = document.querySelectorAll(".expense-check");

  let totalINR = 0;
  let totalOriginal = 0;
  let currencyTotals = {};

  checkboxes.forEach(cb => {

    let row = cb.closest("tr");

    // ✅ visual effect (safe)
    if(row){
      row.style.opacity = cb.checked ? "1" : "0.5";
    }

    if(!cb.checked) return;

    let index = cb.dataset.index;
    let e = expenses[index];

    if(!e) return;

    totalINR += e.amt;

    if(e.currency){
      if(!currencyTotals[e.currency]) currencyTotals[e.currency] = 0;
      currencyTotals[e.currency] += e.originalAmount;
    } else {
      totalOriginal += e.amt;
    }

  });

  let originalDisplay = "";

  for(let cur in currencyTotals){
    originalDisplay += `${currencyTotals[cur].toFixed(2)} ${cur} `;
  }

  if(totalOriginal > 0){
    originalDisplay += `₹${totalOriginal.toFixed(2)}`;
  }

  let totalOriginalEl = document.getElementById("totalOriginal");
  let totalINREl = document.getElementById("totalINR");

  if(totalOriginalEl) totalOriginalEl.innerText = originalDisplay;
  if(totalINREl) totalINREl.innerText = "₹" + totalINR.toFixed(2);
}

function renderTopSpenders(){

    let spent = {};

    people.forEach(p=>{
        spent[p]=0;
    });

    expenses.forEach(e=>{
        spent[e.payer]+=e.amt;
    });

    let max=Math.max(...Object.values(spent),1);

    let html="";

    Object.entries(spent)
      .sort((a,b)=>b[1]-a[1])
      .forEach(([name,amount])=>{

          let width=(amount/max)*100;

          html+=`

          <div style="margin-bottom:14px">

             <div style="
             display:flex;
             justify-content:space-between;
             margin-bottom:4px">

                <span>${name}</span>
                <span>₹${amount.toFixed(0)}</span>

             </div>

             <div class="spend-bar">

                 <div class="spend-bar-fill"
                     style="width:${width}%">
                 </div>

             </div>

          </div>
          `;
      });

    document.getElementById("topSpenders").innerHTML=html;
}

function render(){

// ✅ PEOPLE UI
const avatarColors = [
  "#7c3aed",
  "#14b8a6",
  "#ec4899",
  "#f97316",
  "#3b82f6"
];

document.getElementById("peopleList").innerHTML =
people.map((p,i)=>`

<div class="person-item">

  <div style="
      display:flex;
      align-items:center;
      gap:14px">

      <div
        class="person-avatar"
        style="background:${avatarColors[i % avatarColors.length]}">
        ${p.charAt(0).toUpperCase()}
      </div>

      <span>${p}</span>

  </div>

  <span
    onclick="removePerson(${i})"
    style="
      color:#ef4444;
      font-size:26px;
      cursor:pointer;">
      ×
  </span>

</div>

`).join("");

document.getElementById("payer").innerHTML =
  people.map(p=>`<option value="${p}">${p}</option>`).join("");

// ✅ PARTICIPANTS
document.getElementById("participants").innerHTML =
  people.map(p => `
    <div class="participant-chip" onclick="toggleParticipant(this)" data-name="${p}">
      ${p}
    </div>
  `).join("");


// ✅ TABLE
let tb = document.getElementById("tableBody");

let html = "";
let totalINR = 0;
let totalOriginal = 0;
let currencyTotals = {};


// ✅ GROUP DATA (ONLY ONCE)

// ✅ FILTER SECTION (ADD HERE)

let spenderDropdown = document.getElementById("spenderFilter");
let participantDropdown = document.getElementById("participantFilter");

// ✅ Store previous values
let prevSpender = spenderDropdown?.value || "all";
let prevParticipant = participantDropdown?.value || "all";

// ✅ Populate dropdowns
if(spenderDropdown){
  spenderDropdown.innerHTML =
    `<option value="all">All Payers</option>` +
    people.map(p => `<option value="${p}">${p}</option>`).join("");

  spenderDropdown.value = prevSpender;
}

if(participantDropdown){
  participantDropdown.innerHTML =
    `<option value="all">All Participants</option>` +
    people.map(p => `<option value="${p}">${p}</option>`).join("");

  participantDropdown.value = prevParticipant;
}

// ✅ Get selected filter values
let payerFilter = spenderDropdown?.value || "all";
let participantFilter = participantDropdown?.value || "all";

// ✅ Apply filters
let filteredExpenses = expenses.filter(e => {

  let payerMatch = payerFilter === "all" || e.payer === payerFilter;

  let participantMatch =
    participantFilter === "all" ||
    (e.splits && Object.keys(e.splits).includes(participantFilter));

  return payerMatch && participantMatch;
});


// ✅ GROUP DATA (USE filteredExpenses, NOT expenses)
let grouped = {};

filteredExpenses.forEach(e => {
  let d = e.date || "No Date";
  if(!grouped[d]) grouped[d] = [];
  grouped[d].push(e);
});




// ✅ SORT DATES
let sortedDates = Object.keys(grouped).sort((a,b) => new Date(b) - new Date(a));


// ✅ BUILD TABLE
sortedDates.forEach(date => {

  html += `
    <tr class="date-group">
      <td colspan="8">📅 ${date}</td>
    </tr>
  `;

  grouped[date].forEach(e => {

    // ✅ totals    

          html += `
            <tr>
              <td class="tdo">
                <input type="checkbox" class="expense-check" data-index="${expenses.indexOf(e)}"
                  checked
                  onchange="updateTotals()">
              </td>

              <td class="tdp">${e.desc}</td>

        <td class="tdo">          
          ${e.currency 
            ? `
              ${e.originalAmount}
              <div style="font-size:12px;color:gray;">
                (Exch ${e.currency} = ₹${e.rate || "-"})
              </div>
            `
            : `₹${e.amt.toFixed(2)}`
          }
        </td>
        <td class="tdo">₹${e.amt.toFixed(2)}</td>
        <td class="tdo">${e.payer}</td>
        <td class="tdo">${Object.keys(e.splits).join(", ")}</td>
        <td class="tdo">${e.date || ""}</td>
        <td class="tdo">
          <button class="edit-btn" onclick="editExpense(${expenses.indexOf(e)})">Edit</button>
          <button class="delete-btn" onclick="deleteExpense(${expenses.indexOf(e)})">Delete</button>
        </td>
      </tr>
    `;
  });

});

// ✅ RENDER ONCE (no duplicates)
tb.innerHTML = html;

// ✅ VERY IMPORTANT
setTimeout(updateTotals, 0);

// ✅ TOTAL ROW
let originalDisplay = "";

// currencies
for(let cur in currencyTotals){
  originalDisplay += `${currencyTotals[cur].toFixed(2)} ${cur} `;
}

// INR
if(totalOriginal > 0){
  originalDisplay += `₹${totalOriginal.toFixed(2)}`;
}

// ✅ Add total row FIRST
tb.innerHTML += `
<tr class="total-row">
  <td></td>
  <td class="tdp">Total</td>
  <td class="tdo" id="totalOriginal"></td>
  <td class="tdo" id="totalINR"></td>
  <td colspan="4"></td>
</tr>
`;


// ✅ THEN calculate totals
updateTotals();


// ✅ BALANCES (unchanged)
let bal = calcBalances();
let settlementCard = document.getElementById("settlementCard");
let balancesCard = document.getElementById("balancesCard");

if(settlementCard) settlementCard.innerHTML = "";
if(balancesCard) balancesCard.innerHTML = "";

let breakdown = getSettlementBreakdown(bal);

if(breakdown.length){  
    settlementCard.innerHTML = `
    ${breakdown.map(l=>`
    <div style="padding:8px 0;">
    💸 ${l}
    </div>
    `).join("")}
    `;

}




let enabled = document.getElementById("enableCurrency").checked;
let currency = document.getElementById("currencyName").value;
let rate = parseFloat(document.getElementById("exchangeRate").value);

for(let p in bal){

  if(settled[p]){
    totals.innerHTML += `<div class="settled">${p}: Settled ✓</div>`;
    continue;
  }

  let cls = bal[p] >= 0 ? "green" : "red";

  let foreign = "";
  if(enabled && rate > 0){
    foreign = ` (${(bal[p]/rate).toFixed(2)} ${currency})`;
  }

      balancesCard.innerHTML += `
    <div style="
    display:flex;
    justify-content:space-between;
    padding:8px 0;
    font-weight:600">

    <span>${p}</span>

    <span class="${cls}">
    ₹${bal[p].toFixed(2)}
    </span>

    </div>
    `;

}

renderCharts();
renderInsights();
renderTopSpenders();

}




function toggleParticipant(el){
  el.classList.toggle("active");
}

function downloadCSV(){

  let rows = [
    "Description,OriginalAmount,Currency,Rate,INRAmount,Payer,Date,Splits"];

  document.querySelectorAll(".expense-check").forEach(cb => {
    if(!cb.checked) return;
    let e = expenses[cb.dataset.index];
    if(!e) return;
    const cleanSplits = JSON.stringify(e.splits).replace(/"/g, '""');
    rows.push(
      `"${e.desc}",${e.originalAmount || 0},${e.currency || ""},${e.rate || ""},${e.amt},${e.payer},${e.date},"${cleanSplits}"`
    );
  });

  let blob = new Blob([rows.join("\n")], {type:"text/csv"});
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "splitwise_filtered.csv";
  a.click();
}



function printPDF(){

  let original = document.body.innerHTML;

  // ✅ Clone full content (including charts + insights)
  let content = document.getElementById("pdfArea").cloneNode(true);

  // ✅ Remove buttons (Edit/Delete)
  content.querySelectorAll("button").forEach(btn => btn.remove());

  // ✅ Convert charts to images
    let originalCanvases = document.querySelectorAll("canvas");
    let clonedCanvases = content.querySelectorAll("canvas");

    clonedCanvases.forEach((canvas, i) => {
      let img = document.createElement("img");

      try{
        img.src = originalCanvases[i].toDataURL();
      }catch{
        img.src = "";
      }

      img.style.maxWidth = "100%";
      canvas.replaceWith(img);
    });


  // ✅ Build PDF view
 document.body.innerHTML = `
  <div style="text-align:center; margin-bottom:20px;">
    .pnglogo<br>
    <h2>Anshuman's Splitwise</h2>
    <h4>Expense Analytics Report</h4>
  </div>
  ${content.innerHTML}
`;

  window.print();

  // ✅ restore page
  document.body.innerHTML = original;
  location.reload();
}


function resetAll(){
  if(!confirm("⚠️ This will delete ALL data permanently. Continue?")) return;

  // Clear arrays
  people = [];
  expenses = [];
  settled = {};

  // Clear localStorage
  localStorage.removeItem("people");
  localStorage.removeItem("expenses");
  localStorage.removeItem("settled");

  // Optional: clear form inputs
  document.getElementById("personName").value = "";
  document.getElementById("desc").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("date").value = "";
  document.getElementById("splitValues").value = "";

  // Refresh UI
  render();
}

window.addEventListener("beforeunload", function () {
  save();
});

setInterval(() => {
  save();
  console.log("Auto-saved");
}, 5000); // every 5 seconds


// ✅ Toggle code for currency
document.addEventListener("DOMContentLoaded", function(){

  const checkbox = document.getElementById("enableCurrency");
  const currencyInput = document.getElementById("currencyName");
  const rateInput = document.getElementById("exchangeRate");

  // ✅ Load saved values
  checkbox.checked = currencyConfig.enabled;
  currencyInput.value = currencyConfig.currency;
  rateInput.value = currencyConfig.rate;

  function updateCurrencyFields(){
    const show = checkbox.checked;
    currencyInput.style.display = show ? "block" : "none";
    rateInput.style.display = show ? "block" : "none";
    currencyInput.style.opacity = show ? "1" : "0";
    rateInput.style.opacity = show ? "1" : "0";
  }

  updateCurrencyFields();
  // ✅ Save config when changed
  checkbox.addEventListener("change", () => {
    currencyConfig.enabled = checkbox.checked;
    saveCurrencyConfig();
    updateCurrencyFields();
  });

  currencyInput.addEventListener("input", () => {
    currencyConfig.currency = currencyInput.value;
    saveCurrencyConfig();
  });

  rateInput.addEventListener("input", () => {
    currencyConfig.rate = parseFloat(rateInput.value) || 1;
    saveCurrencyConfig();
  });
});
