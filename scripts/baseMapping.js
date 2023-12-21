class baseMapping {

    constructor(actor, sheetType, sheet) {
        console.group("baseMapping.constructor");
        this.sheetType = sheetType;
        this.actor = actor;
        this.sheet = sheet;
        console.debug("sheetType:", this.sheetType);
        console.debug("actor:", this.actor);
        console.groupEnd()
        /*
        schema for fieldMappings:
          pdf: string, pdf fieldname
          content: string, what to use to eval
          calculated: string, the result of eval(content)
          font: string, the name of the font
          font_size: int, the size of the associated font
        */
        this.fieldMappings = [];
        this.logPrefix = "Export Sheet";
        this.systemName = "test";
        this.createMappings();
    }

    log(severity, message, options) {
        /* A wrapper around the foundry vtt logger or `console`, whichever is present */
        if ( typeof(ui) !== "undefined" ) {
            switch(severity) {
                case 'error':
                    ui.notifications.error(`${this.logPrefix} | ${this.systemName} | ${message}`, options);
                    break;
                case 'warn':
                case 'warning':
                    ui.notifications.warn(`${this.logPrefix} | ${this.systemName} | ${message}`, options);
                    break;
                case 'debug':
                    console.debug(`${this.logPrefix} | ${this.systemName} | ${message}`);
                    break;
                default:
                    ui.notifications.info(`${this.logPrefix} | ${this.systemName} | ${message}`, options);
            }
        } else {
            switch(severity) {
                case 'error':
                    console.error(`${this.logPrefix} | ${this.systemName} | ${message}`);
                    break;
                case 'warn':
                case 'warning':
                    console.warn(`${this.logPrefix} | ${this.systemName} | ${message}`);
                    break;
                case 'debug':
                    console.debug(`${this.logPrefix} | ${this.systemName} | ${message}`);
                    break;
                default:
                    console.info(`${this.logPrefix} | ${this.systemName} | ${message}`);
            }
        }
    }

    logDebug(message, options) {
        this.log("debug", message, options);
    }

    logError(message, options) {
        this.log("error", message, options);
    }

    logInfo(message, options) {
        this.log("info", message, options);
    }

    logWarning(message, options) {
        this.log("warning", message, options);
    }

    updateMapping(fieldName, data) {
        fieldName = fieldName.trim();
        let el = this.fieldMappings.filter(i => i.pdf === fieldName);
        if (el.length === 0) {
            el = Object.assign({"pdf": fieldName}, data);
        } else if (el.length > 1) {
            this.logError("More than one element was found with pdf field name ${fieldName}! What is going on?");
        } else {
            el = Object.assign(el[0], data);
        }
        this.fieldMappings = this.fieldMappings.filter(i => i.pdf !== fieldName);
        this.fieldMappings.push(el);
    }

    /* duplicate method name
    getMapping(fieldName) {
        // pdf field getter
        if (this.fieldMappings.map(i => i.pdf).includes(fieldName)) {
            return this.fieldMappings[fieldName];
        } else {
            this.logWarning(`${fieldName} does not exist`);
            return {};
        }
    }
    */

    setCalculated(fieldName, value, force=false) {
        fieldName = fieldName.trim();
        this.updateMapping(fieldName, {"calculated": value});
    }

    setFont(fieldName, fontName=undefined, fontSize=undefined, force=false) {
        fieldName = fieldName.trim();
        let font = {};
        if ( fontName !== undefined ) {
            font.font = String(fontName).trim();
        }
        if (!isNaN(parseInt(fontSize))) {
            font.font_size = parseInt(fontSize);
        }
        if ( Object.keys(font).length > 0 ) {
            this.updateMapping(fieldName, font);
            return true;
        }
        return false;
    }

    createMappings(){
        this.fieldMappings = [];
    }

    get fields() {
        return this.fieldMappings;
    }
}

export default baseMapping;