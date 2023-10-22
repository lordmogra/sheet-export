
import { PDFDocument } from './lib/pdf-lib.esm.js';
import { registerSettings } from "./settings.js";
import { getMapping, getPdf, getSheeType } from "./sheet-export-api.js";

Hooks.once('ready', async function () {

});
/* global pdfform minipdf saveAs */

// Store mapping
Hooks.once('init', async function () {
	// TODO refactor this moving to settings
	game.settings.register(SheetExportconfig.ID, "mapping", {
		name: "sheet-export.settings.mapping.Name",
		hint: "sheet-export.settings.mapping.Hint",
		scope: "world",
		config: true,
		type: String,
		default: "[]",
	});

	game.settings.register(SheetExportconfig.ID, "mapping-npc", {
		name: "sheet-export.settings.mapping-npc.Name",
		hint: "sheet-export.settings.mapping-npc.Hint",
		scope: "world",
		config: true,
		type: String,
		default: "[]",
	});

	if (game.version && isNewerVersion(game.version, "9.230")) {
		game.keybindings.register(SheetExportconfig.ID, "showConfig", {
			name: "Show Config",
			hint: "Show PDF config menu for the character currently open",
			onDown: () => {
				// If the currently opened sheet is an Actor sheet, open the PDF config for the actor
				if (ui.activeWindow instanceof ActorSheet) {
					new SheetExportconfig(ui.activeWindow.object).render(true);
				}
			},
		});
	}
	registerSettings();
});

// Inject editor into the settings menu
Hooks.on("renderSettingsConfig", (app, html) => {
	// Only if GM
	if (game.user.isGM) {
		// Create a new text box
		let editor, newTextBox;

		// Get the old text box
		const oldTextBox = html[0].querySelector("[name='sheet-export.mapping']");

		// NPC part (just duplicate the previous fields)
		let editorNPC, newTextBoxNPC;

		// Get the old text box
		const oldTextBoxNPC = html[0].querySelector("[name='sheet-export.mapping-npc']");

		// If Ace Library is enabled use an Ace Editor
		if (game.modules.get("acelib")?.active) {
			/* global ace */
			// Create an editor
			newTextBox = document.createElement("div");
			editor = ace.edit(newTextBox);

			// Set to the default options
			editor.setOptions(ace.userSettings);

			// Set to JavaScript mode
			editor.session.setMode("ace/mode/javascript");

			// Copy the value from the old textbox into the Ace Editor
			editor.setValue(oldTextBox.value);

			// After a short wait (to make sure the editor is loaded), beautify the editor contents
			setTimeout(() => editor.execCommand("beautify"), 500);

			// Hide annotations
			editor.getSession().on(
				"changeAnnotation",
				debounce(() => editor.getSession().setAnnotations(), 1)
			);
			newTextBoxNPC = document.createElement("div");
			editorNPC = ace.edit(newTextBoxNPC);

			// Set to the default options
			editorNPC.setOptions(ace.userSettings);

			// Set to JavaScript mode
			editorNPC.session.setMode("ace/mode/javascript");

			// Copy the value from the old textbox into the Ace Editor
			editorNPC.setValue(oldTextBoxNPC.value);

			// After a short wait (to make sure the editor is loaded), beautify the editor contents
			setTimeout(() => editorNPC.execCommand("beautify"), 500);

			// Hide annotations
			editorNPC.getSession().on(
				"changeAnnotation",
				debounce(() => editorNPC.getSession().setAnnotations(), 1)
			);
		} else {
			// Otherwise create new textarea
			newTextBox = document.createElement("textarea");

			// Copy the value from the old textbox into the new one
			newTextBox.value = oldTextBox.value;
			// Otherwise create new textarea NPC
			newTextBoxNPC = document.createElement("textarea");

			// Copy the value from the old textbox into the new one
			newTextBoxNPC.value = oldTextBoxNPC.value;
		}

		// Don't show the old textbox
		oldTextBox.style.display = "none";

		// Give the editor some height
		newTextBox.style.height = "20em";

		// Make the editor take up the full width
		oldTextBox.parentElement.style.flex = "100%";

		// Insert the new textbox right after the old one
		oldTextBox.after(newTextBox);

		// Don't show the old textbox NPC
		oldTextBoxNPC.style.display = "none";

		// Give the editor some height
		newTextBoxNPC.style.height = "20em";

		// Make the editor take up the full width
		oldTextBoxNPC.parentElement.style.flex = "100%";

		// Insert the new textbox right after the old one
		oldTextBoxNPC.after(newTextBoxNPC);

		if (game.modules.get("acelib")?.active) {
			// Update whenever the ace editor changes
			editor.on("change", () => {
				// Copy the value from the ace editor to the old textbox
				oldTextBox.value = editor.getValue();
			});
			editorNPC.on("change", () => {
				// Copy the value from the ace editor to the old textbox
				oldTextBoxNPC.value = editorNPC.getValue();
			});
		} else {
			// Update whenever the new textbox changes
			newTextBox.addEventListener("change", () => {
				// Copy the value from the new textbox to the old one
				oldTextBox.value = newTextBox.value;
			});
			newTextBoxNPC.addEventListener("change", () => {
				// Copy the value from the new textbox to the old one
				oldTextBoxNPC.value = newTextBoxNPC.value;
			});
		}

		// Create mapping select menu
		const mappingSelect = document.createElement("select");
		mappingSelect.style.margin = "10px 0";
		oldTextBox.parentNode.before(mappingSelect);

		// Browse and get list of included mapping files
		FilePicker.browse("data", "modules/sheet-export/mappings", { extensions: [".mapping"] }).then(results => {
			// Add the default option first
			results.files.unshift("");

			// Add options for each included mapping
			results.files.forEach(name => {
				// Create the option
				const option = document.createElement("option");
				mappingSelect.append(option);

				// Add just the name of the system as the text
				name = name.split("/").at(-1).replace(".mapping", "");
				option.innerHTML = name;
			});
		});

		// Create mapping select menu NPC
		const mappingSelectNPC = document.createElement("select");
		mappingSelectNPC.style.margin = "10px 0";
		oldTextBoxNPC.parentNode.before(mappingSelectNPC);

		// Browse and get list of included mapping files
		FilePicker.browse("data", "modules/sheet-export/mappings", { extensions: [".mapping"] }).then(results => {
			// Add the default option first
			results.files.unshift("");

			// Add options for each included mapping
			results.files.forEach(name => {
				// Create the option
				const option = document.createElement("option");
				mappingSelectNPC.append(option);

				// Add just the name of the system as the text
				name = name.split("/").at(-1).replace(".mapping", "");
				option.innerHTML = name;
			});
		});

		// Resize the Settings Config App
		app.setPosition();

		// Add an event listener
		mappingSelect.addEventListener("change", async () => {
			// Fetch selected mapping if not empty
			const mapping = mappingSelect.value
				? await fetch(getRoute(`/modules/sheet-export/mappings/${mappingSelect.value}.mapping`)).then(response =>
					response.text()
				)
				: "";

			// Copy the mapping to the old text box
			oldTextBox.value = mapping;
			if (game.modules.get("acelib")?.active) {
				// Copy the mapping to the ace editor
				editor.setValue(mapping);
			} else {
				// Copy the mapping to the new textbox
				newTextBox.value = mapping;
			}
		});
		mappingSelectNPC.addEventListener("change", async () => {
			// Fetch selected mapping if not empty
			const mapping = mappingSelectNPC.value
				? await fetch(getRoute(`/modules/sheet-export/mappings/${mappingSelectNPC.value}.mapping`)).then(response =>
					response.text()
				)
				: "";

			// Copy the mapping to the old text box
			oldTextBoxNPC.value = mapping;
			if (game.modules.get("acelib")?.active) {
				// Copy the mapping to the ace editor
				editorNPC.setValue(mapping);
			} else {
				// Copy the mapping to the new textbox
				newTextBoxNPC.value = mapping;
			}
		});
	}
});

// Add button to Actor Sheet for opening app
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
	console.log("check the sheet")
	console.log(sheet)
	console.log(sheet.actor)
	// If this is not a player character sheet, return without adding the button
	// added pc for cypher system
	let sheetType = getSheeType(actor);
	//	if (!["character", "PC", "Player", "npc", "pc"].includes(sheet.actor.type ?? sheet.actor.data.type)) return;

	buttons.unshift({
		label: "Export to PDF",
		class: "export-pdf",
		icon: "fas fa-file-export",
		onclick: () => {
			// Open Config window
			new SheetExportconfig(sheet.actor, sheetType).render(true);

			// Bring window to top
			Object.values(ui.windows)
				.filter(window => window instanceof SheetExportconfig)[0]
				?.bringToTop();
		},
	});
});

class SheetExportconfig extends FormApplication {
	constructor(actor, sheetType) {
		super();
		this.sheetType = sheetType;
		this.actor = actor;
		this.filledPdf = new ArrayBuffer();
		this.currentBuffer = new ArrayBuffer();
	}

	/** The module's ID */
	static ID = "sheet-export";

	/** @override */
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			template: "modules/sheet-export/templates/module.hbs",
			id: "sheet-export-form",
			height: (window.innerHeight * 7) / 8,
			width: Math.max(window.innerWidth / 3, 600),
			resizable: true,
			title: "Export to PDF",
		});
	}

	/** @override */
	activateListeners() {
		document.getElementById("sheet-export-upload").addEventListener("change", event => {
			const file = event.target.files[0];
			const reader = new FileReader();
			reader.onload = ev => this.onFileUpload(ev.target.result);
			reader.readAsArrayBuffer(file);
		});

		document.getElementById("sheet-export-final").addEventListener("click", event => {
			event.preventDefault();
			this.download(this.currentBuffer);
		});

		document.getElementById("sheet-export-download")?.addEventListener("click", event => event.preventDefault());
	}

	/** @override */
	getData() {
		const system = game.system.id;
		return {
			download: {
				show: !!game.i18n.translations.pdfsheet?.download[system],
				label: game.i18n.localize(`sheet-export.download.${system}.label`),
				title: game.i18n.localize(`sheet-export.download.${system}.title`),
				url: game.i18n.localize(`sheet-export.download.${system}.url`),
			},
		};
	}

	/** Create a form with inputs for each PDF field and fill them in with Actor data */
	/*
		createForm(buffer) {
			const inputForm = document.getElementById("fieldList");
	
			// Empty input form
			let child;
			while ((child = inputForm.lastChild)) {
				inputForm.removeChild(child);
			}
	
			// Get PDF fields
			const pdfFields = pdfform(minipdf).list_fields(buffer);
			// Get Actor data
			const actor = this.actor;
	
			// Begin grouping logs
			console.group("PDF Sheet");
			// Log Actor Data
			console.log("Actor Data:", actor);
			// Log all PDF fields
			console.log("PDF fields:", pdfFields);
	
			// Get mapping from settings
			let mapping = ""
	
			if (["character", "PC", "Player", "pc"].includes(actor.type ?? actor.data.type)) {
				console.log("got mapping for PC")
				mapping = game.settings.get(SheetExportconfig.ID, "mapping");
			}
			if (["npc"].includes(actor.type ?? actor.data.type)) {
				console.log("got mapping for NPC")
				mapping = game.settings.get(SheetExportconfig.ID, "mapping-npc");
			}
	
	
			// Parse dynamic keys
			mapping = mapping.replaceAll("@", game.release.generation > 10 ? "actor." : "actor.data.");
	
	
			// Log un-evaluated mapping
			console.log("Raw mapping:", mapping);
	
			// Try to deserialize mapping
			try {
				// Return as evaluated JavaScript with the actor as an argument
				mapping = Function(`"use strict"; return function(actor) { return ${mapping} };`)()(actor);
			} catch (err) {
				// End console group
				console.groupEnd();
				// Close the application
				this.close();
	
				// Alert if invalid
				ui.notifications.error(
					'PDF Sheet | Invalid mapping JavaScript Object. See the <a href="https://github.com/arcanistzed/sheet-export/blob/main/README.md">README</a> for more info.'
				);
	
				// Evaluate the JS again to throw the error
				Function(`"use strict"; return function(actor) { return ${mapping} };`)()(actor);
			}
	
			// Log parsed mapping
			console.log("Parsed mapping:", mapping);
			// Close log grouping
			console.groupEnd();
	
			// Loop through each key
			Object.keys(pdfFields).forEach(pdfFieldKey => {
				// Create row
				const row = document.createElement("li");
	
				// Create label
				const label = document.createElement("label");
				label.innerText = `${pdfFieldKey}: `;
				label.htmlFor = pdfFieldKey;
	
				// Insert label
				row.prepend(label);
				inputForm.appendChild(row);
	
				pdfFields[pdfFieldKey].forEach((field, i) => {
					if (field.type === "radio" && field.options) {
						const fieldSet = document.createElement("fieldset");
						fieldSet.id = pdfFieldKey;
	
						field.options.forEach(value => {
							const radioLabel = document.createElement("label");
							const radio = document.createElement("input");
							radio.disabled = true;
	
							radio.setAttribute("type", "radio");
							radio.setAttribute("value", value);
							radio.setAttribute("name", pdfFieldKey + i);
							radio.setAttribute("data-idx", i);
							radio.setAttribute("data-key", pdfFieldKey);
	
							radioLabel.appendChild(radio);
							radioLabel.innerText = value;
							fieldSet.appendChild(radioLabel);
						});
	
						row.appendChild(fieldSet);
						return;
					}
	
					// Create an input
					const input = document.createElement(
						field.type === "select" ? "select" : field.type === "string" ? "textarea" : "input"
					);
					input.disabled = true;
					input.setAttribute("data-idx", i);
					input.setAttribute("data-key", pdfFieldKey);
					input.id = pdfFieldKey;
	
					// Make a checkbox if the type is boolean
					if (field.type === "boolean") {
						input.setAttribute("type", "checkbox");
	
						// Make a drop down menu if the type is select and it has options
					} else if (field.type === "select" && field.options) {
						field.options.forEach(value => {
							const option = document.createElement("option");
							option.innerText = Array.isArray(value) ? value[1] : value;
							option.setAttribute("value", Array.isArray(value) ? value[0] : value);
							input.appendChild(option);
						});
					}
					row.appendChild(input); // Add to DOM
	
					// Add values from character sheet
					// Loop through all entries in the mapping
					mapping.forEach(entry => {
						// Check if the current field in the PDF matches an entry in the mapping
						if (pdfFieldKey.trim() === entry.pdf) {
							// Set the input to what is on the character sheet
							if (field.type === "boolean") {
								// If it's a checkbox
								input.checked = entry.foundry;
							} else if (field.type === "string") {
								// If it's a textarea
								input.innerHTML = entry.foundry;
							} else if (field.type === "select") {
								// If it's a selectbox
								input.value = entry.foundry;
							} else {
								// If it's anything else
								input.setAttribute("value", entry.foundry);
							}
						}
					});
				});
			});
		}
	*/
	/** Get values and download PDF */
	download(buffer) {
		/*
		const fieldList = document.getElementById("fieldList");
		const fields = {};
		fieldList.querySelectorAll("input, textarea, select").forEach(input => {
			if (input.getAttribute("type") === "radio" && !input.checked) {
				return;
			}

			const key = input.getAttribute("data-key");
			if (!fields[key]) {
				fields[key] = [];
			}
			const index = parseInt(input.getAttribute("data-idx"), 10);

			const value =
				input.type === "textarea"
					? input.innerHTML
					: input.getAttribute("type") === "checkbox"
						? input.checked
						: input.value;
			fields[key][index] = value;
		});
*/
		//		const filled_pdf = pdfform(minipdf).transform(buffer, fields);

		const blob = new Blob([this.filledPdf], { type: "application/pdf" });
		saveAs(blob, `${this.actor.name ?? "character"}.pdf`);
	}

	/** Manage new PDF upload */
	onFileUpload(buffer) {
		this.currentBuffer = buffer;
		this.createForm(this.currentBuffer);

		document.getElementById("sheet-export-header").setAttribute("style", "display: none");
		document.getElementById("sheet-export-final").style.display = "block";
	}

	getMapping = getMapping;
	getPdf = getPdf;
	/*
		async getMapping(mappingChoice, mappingRelease, mappingElement) {
			console.log("get mapping");
			console.log(`/modules/sheet-export/mappings/${game.system.id}/${mappingChoice}/${mappingRelease}/${mappingElement}.json`);
			console.log(getRoute(`/modules/sheet-export/mappings/${game.system.id}/${mappingChoice}/${mappingRelease}/${mappingElement}.json`));
			const mapping = await fetch(getRoute(`/modules/sheet-export/mappings/${game.system.id}/${mappingChoice}/${mappingRelease}/${mappingElement}.json`)).then(response =>
				response.text()
			);
			console.log(mapping);
			try {
				return JSON.parse(mapping);
			} catch (err) {
				console.error('Error parsing JSON:', err);
				return {};
			}
		}
	
		async getPdf(pdfUrl) {
			console.log(pdfUrl);
			const formBytes = await fetch(getRoute(pdfUrl)).then((res) => res.arrayBuffer());
	
			const pdfDoc = await PDFDocument.load(formBytes);
			return pdfDoc;
		}
	*/
	async createForm() {
		console.log("create form");
		const inputForm = document.getElementById("fieldList");

		// get the mapping
		let mappingVersion = game.settings.get(SheetExportconfig.ID, "mapping-version");
		let mappingRelease = game.settings.get(SheetExportconfig.ID, "mapping-release");
		const mapping = await this.getMapping(mappingVersion, mappingRelease, this.sheetType);
		console.log("got mapping");
		const pdf = await this.getPdf(mapping.pdfUrl);
		const form = pdf.getForm();
		const fields = form.getFields()
		var i = 0;
		fields.forEach(field => {
			const type = field.constructor.name.trim();
			const name = field.getName().trim();
			console.log(`${type}: ${name}`)
			// Create row
			const row = document.createElement("li");

			// Create label
			const label = document.createElement("label");
			label.innerText = `${name}: `;
			label.htmlFor = name;

			// Insert label
			row.prepend(label);
			inputForm.appendChild(row);
			// Create an input
			const input = document.createElement("textarea");
			input.disabled = true;
			input.setAttribute("data-idx", i);
			input.setAttribute("data-key", name);
			input.id = name;

			var fieldMapping = mapping.fields.find(f => f.pdf === name)
			console.log(fieldMapping)
			var contentMapping = fieldMapping ? fieldMapping.content.replaceAll("@", game.release.generation > 10 ? "actor." : "actor.data.") : "";
			contentMapping = "{'calculated': " + contentMapping + " }";
			console.log(contentMapping);
			var mappingValue = "";
			const actor = this.actor;
			//			console.log("the actor");
			//			console.log(actor);
			try {
				// Return as evaluated JavaScript with the actor as an argument
				mappingValue = Function(`"use strict"; return function(actor) { return ${contentMapping} };`)()(actor);
				console.log(mappingValue);
			} catch (err) {
				console.log(err);
			}
			switch (type) {
				case "PDFTextField":
					//					input.setAttribute("type", "string");
					console.log(mappingValue.calculated);
					input.innerHTML = mappingValue ? mappingValue.calculated : "";
					field.setText(mappingValue ? (mappingValue.calculated ? mappingValue.calculated.toString() : "") : "");
					break;
				case "PDFCheckBox":
					console.log(mappingValue.calculated);
					input.setAttribute("type", "checkbox");
					input.checked = mappingValue ? mappingValue.calculated : "";
					// before check if mappingValue is defined, than since we expect a boolean we can set the value directly
					mappingValue ? (mappingValue.calculated ? field.check() : field.uncheck()) : field.uncheck();
					break;

				default:
					console.log("nothing in switch");
					break;
			}
			row.appendChild(input); // Add to DOM

			i++;
		})
		// elaborated all the fields, now we can download the pdf
		this.filledPdf = await pdf.save();
	}
}
