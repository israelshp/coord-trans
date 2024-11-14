const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const flipCRSButton = document.querySelector("#flip");
let selectedFile = null;
let coordsData = [];
let inputCRS;
let outputCRS;
const xFieldNames = ["x", "longitude", "lng", "long"];
const yFieldNames = ["y", "latitude", "lat"];

flipCRSButton.addEventListener("click", flipCRS);

// Handle file selection via click
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (event) =>
  handleFile(event.target.files[0])
);

// Drag-and-drop events
dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragover");
  if (event.dataTransfer.files.length > 0) {
    handleFile(event.dataTransfer.files[0]);
  }
});

function flipCRS() {
  inputCRS = document.getElementById("crs-input").dataset.value;
  outputCRS = document.getElementById("crs-output").dataset.value;

  const inputCRSName = document.getElementById("crs-input").textContent;
  const outputCRSName = document.getElementById("crs-output").textContent;

  document.getElementById("crs-input").textContent = outputCRSName;
  document.getElementById("crs-output").textContent = inputCRSName;

  document.getElementById("crs-input").dataset.value = outputCRS;
  document.getElementById("crs-output").dataset.value = inputCRS;
}

function handleFile(file) {
  coordsData = [];
  if (file.type === "text/csv") {
    selectedFile = file;

    Papa.parse(selectedFile, {
      header: true,
      complete: (results) => {
        let fields = results.meta.fields;
        populateFields(fields);
        results.data.forEach((row) => coordsData.push(row));
        console.table(coordsData);
        dropZone.innerHTML = `${file.name}<br/> (${coordsData.length} רשומות)`;
        buildTable(coordsData, fields);
      },
    });
  } else {
    alert("יש לבחור בקובץ CSV עם עמודות X ו-Y");
  }
}
function buildTable(data, fields) {
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  table.appendChild(thead);
  table.appendChild(tbody);

  const titleRow = document.createElement("tr");
  fields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = field;
    titleRow.appendChild(th);
  });
  thead.appendChild(titleRow);
  data.forEach((row, idx) => {
    const tr = document.createElement("tr");
    Object.keys(row).forEach((key) => {
      const td = document.createElement("td");
      td.textContent = row[key];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  dropZone.style.alignItems = "flex-start";
  dropZone.innerHTML = "";
  dropZone.appendChild(table);
}
function populateFields(fields) {
  document.querySelector(".fields").style.display = "flex";
  document.querySelectorAll(".field-select").forEach((select) => {
    select.innerHTML = "";
    fields.forEach((field) => {
      let option = document.createElement("option");
      option.value = field;
      option.textContent = field;
      select.appendChild(option);
      let possibleFieldNames = null;
      if (select.name === "field-x") {
        possibleFieldNames = xFieldNames;
      } else if (select.name === "field-y") {
        possibleFieldNames = yFieldNames;
      }
      if (
        !!possibleFieldNames &&
        possibleFieldNames.includes(field.toLowerCase())
      ) {
        select.value = field;
      }
    });
  });
}

async function convertCSV() {
  inputCRS = document.getElementById("crs-input").dataset.value;
  outputCRS = document.getElementById("crs-output").dataset.value;

  const fieldX = document.getElementById("field-x").value;
  const fieldY = document.getElementById("field-y").value;

  if (fieldX === fieldY) {
    alert("יש לבחור שדות שונות עבור X ו-Y");
  }

  if (!inputCRS || !outputCRS || !selectedFile) {
    alert("Please provide input CRS, output CRS, and a CSV file.");
    return;
  }

  try {
    proj4.defs(
      inputCRS,
      proj4.defs(inputCRS) || (await fetchCRSDefinition(inputCRS))
    );
    proj4.defs(
      outputCRS,
      proj4.defs(outputCRS) || (await fetchCRSDefinition(outputCRS))
    );
  } catch (error) {
    alert("Invalid CRS code or CRS not found.");
    return;
  }

  let isValid = true;
  invalidCoords = null;

  let outputData = coordsData.map((row) => {
    if (row[fieldX] && row[fieldY]) {
      console.log(row[fieldX], row[fieldY]);
      // assuming the CSV has x, y columns
      const [x, y] = proj4(inputCRS, outputCRS, [
        parseFloat(row[fieldX]),
        parseFloat(row[fieldY]),
      ]);
      console.log(x, y);
      if (!isFinite(x) || !isFinite(y)) {
        isValid = false;
        invalidCoords = `${row[fieldX]}, ${row[fieldY]}`;
      }
      return {
        ...row,
        [`${fieldX}_${outputCRS}`]: x.toFixed(6),
        [`${fieldY}_${outputCRS}`]: y.toFixed(6),
      };
    }
    return row;
  });

  if (!isValid) {
    alert(
      `הערכים ${invalidCoords} לא תקינים עבור רשת הקואורדינטות שנבחרה (${inputCRS})`
    );
    return;
  }

  downloadCSV(outputData);

  // Papa.parse(selectedFile, {
  //   header: true,
  //   encoding: "utf-8",
  //   complete: function (results) {
  //     let isValid = true;
  //     invalidCoords = null;
  //     const transformedData = results.data.map((row) => {
  //       if (row[fieldX] && row[fieldY]) {
  //         console.log(row[fieldX], row[fieldY]);
  //         // assuming the CSV has x, y columns
  //         const [x, y] = proj4(inputCRS, outputCRS, [
  //           parseFloat(row[fieldX]),
  //           parseFloat(row[fieldY]),
  //         ]);
  //         console.log(x, y);
  //         if (!isFinite(x) || !isFinite(y)) {
  //           isValid = false;
  //           invalidCoords = `${row[fieldX]}, ${row[fieldY]}`;
  //         }
  //         return {
  //           ...row,
  //           [`${fieldX}_${outputCRS}`]: x.toFixed(6),
  //           [`${fieldY}_${outputCRS}`]: y.toFixed(6),
  //         };
  //       }
  //       return row;
  //     });

  //     if (!isValid) {
  //       alert(
  //         `הערכים ${invalidCoords} לא תקינים עבור רשת הקואורדינטות שנבחרה (${inputCRS})`
  //       );
  //       return;
  //     }

  //     downloadCSV(transformedData);
  //   },
  // });
}

async function fetchCRSDefinition(epsgCode) {
  const response = await fetch(`https://epsg.io/${epsgCode}.proj4`);
  if (!response.ok) throw new Error("Failed to fetch CRS definition");
  return response.text();
}

function downloadCSV(data) {
  const csv = Papa.unparse(data);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // Add UTF-8 BOM
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${selectedFile.name.split(".")[0]}_${outputCRS}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
