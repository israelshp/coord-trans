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
      if (row[key].includes("°")) {
        td.style.direction = "ltr";
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  dropZone.style.alignItems = "flex-start";
  dropZone.style.justifyContent = "space-between";
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

function parseDMS(input) {
  const parts = input.split(/[^\d\w.]+/);
  const degrees = parseFloat(parts[0]);
  const minutes = parseFloat(parts[1]);
  const seconds = parseFloat(parts[2]);
  const direction = parts[3];
  return { degrees, minutes, seconds, direction };
}

function convertDMStoDD(degrees, minutes, seconds, direction) {
  let dd = degrees + minutes / 60 + seconds / (60 * 60);

  if (direction === "S" || direction === "W") {
    dd = dd * -1;
  }

  return dd;
}

async function convertCSV() {
  document.querySelector(".loading").style.display = "inline-block";
  inputCRS = document.getElementById("crs-input").dataset.value;
  outputCRS = document.getElementById("crs-output").dataset.value;

  const fieldX = document.getElementById("field-x").value;
  const fieldY = document.getElementById("field-y").value;

  if (fieldX === fieldY) {
    alert("יש לבחור עמודות שונות עבור X ו-Y");
  }

  if (!inputCRS || !outputCRS || !selectedFile) {
    alert("יש לטעון קובץ");

    document.querySelector(".loading").style.display = "none";
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

    document.querySelector(".loading").style.display = "none";
    return;
  }

  let isValid = true;
  invalidCoords = null;

  let outputData = coordsData.map((row, idx) => {
    if (row[fieldX] && row[fieldY]) {
      let valueX = row[fieldX];
      let valueY = row[fieldY];
      if (valueX.includes("°")) {
        console.debug("DMS detected");
        let dmsX = parseDMS(valueX);
        let dmsY = parseDMS(valueY);
        valueX = convertDMStoDD(
          dmsX.degrees,
          dmsX.minutes,
          dmsX.seconds,
          dmsX.direction
        );
        valueY = convertDMStoDD(
          dmsY.degrees,
          dmsY.minutes,
          dmsY.seconds,
          dmsY.direction
        );
      } else {
        // trim any non-digit characters
        valueX = valueX.replaceAll(/^\D+|\D+$/g, "");
        valueY = valueY.replaceAll(/^\D+|\D+$/g, "");
      }
      valueX = parseFloat(valueX);
      valueY = parseFloat(valueY);
      if (isNaN(valueX) || isNaN(valueY)) {
        alert(`ערך לא תקין בשורה ${idx + 1}: (${row[fieldX]}, ${row[fieldY]})`);
        document.querySelector(".loading").style.display = "none";
      }
      const [x, y] = proj4(inputCRS, outputCRS, [valueX, valueY]);
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
    document.querySelector(".loading").style.display = "none";
    return;
  }

  document.querySelector(".loading").style.display = "none";

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
