/* Crucible Diff Marker */

/* A single diff data */
class CDMDiff
{
    constructor() {
        this.left_from = 0;
        this.left_to = 0;
        this.right_from = 0;
        this.right_to = 0;
        this.rows = [];
    }
    addRow(row) {
        let left = row.attr("data-from") || 0;
        this.left_from = this.left_from || left;
        this.left_to = left;

        let right = row.attr("data-to") || 0;
        this.right_from = this.right_from || right;
        this.right_to = right;

        this.rows.push(row);
    }
    getId() {
        return `diff_${this.left_from}_${this.right_from}`;
    }
    toString() {
        return `Diff( left: ${this.left_from}-${this.left_to} right: ${this.right_from}-${this.right_to} )`;
    }
}

/* Main class */
class CDM
{
    DIFF_DATA_MAX_ATTEMPTS = 30;
    DIFF_DATA_ATTEMPTS_DELAY_MS = 1000;

    constructor()
    {
        this.data = null;
        this.redUrl = chrome.runtime.getURL("images/red-128.png");
        this.greenUrl = chrome.runtime.getURL("images/green-128.png");
    }

    start()
    {
        $(window).on('hashchange', this.hashChanged.bind(this));
        this.hashChanged();
    }

    hashChanged()
    {
        this.href = window.location.href;
        this.dataKey = "cdm::" + this.href;

        let hash = window.location.hash;
        console.log("hashchanged: " + hash);
        if (!hash.startsWith("#CFR")) {
            console.log("No #CFR, exiting");
            return;
        }

        // Prepare some identifiers
        let id = hash.substr(5);
        this.id = id;
        this.barId = "cdm-bar-" + id;
        this.statsId = "cdm-stats-" + id;
        this.messageId = "cdm-message-" + id;

        this.bar = this.getBar();
        console.log(this.bar);

        // Load data for this file diff
        this.initDataLoad();
    }

    getBar()
    {
        let bar = $("#"+this.barId);
        console.log(bar);
        if (bar.length === 0) {
            /** Create a new bar */
            let fci = $("#frx-context-info-" + this.id);
            if (fci.length === 0) {
                console.error("Can't find frx-context-info");
                return;
            }
            fci.after(`
<div class="cdm-bar" id="${this.barId}">
<span class="cdm-stats" id="${this.statsId}"></span>
<span class="cdm-message" id="${this.messageId}"></span>
</div>
`);
            bar = $("#"+this.barId);
        }
        console.log("bar=" + bar);
        return bar;
    }

    initDataLoad()
    {
        chrome.storage.local.get([this.dataKey], this.dataLoaded.bind(this));
    }

    dataLoaded(result)
    {
        this.message("LOADED!");

        console.log("Loaded data: " + JSON.stringify(result));

        this.data = result[this.dataKey] || { done: [] };
        if (!this.data) {
            /** Initialize to an empty set */
            this.data = {
                done: []
            }
        }

        this.waitDiffAttempts = 0;
        this.waitForDiff();
    }

    initDataSave()
    {
        let toSave = {};
        toSave[this.dataKey] = this.data;
        chrome.storage.local.set(toSave, this.dataSaved.bind(this));

    }

    dataSaved()
    {
        this.message("Data saved!");
    }

    isDone(id)
    {
        return this.data.done.includes(id);
    }

    setDone(id, done)
    {
        // Always remove
        if (this.data.done.indexOf(id) >= 0) {
            this.data.done.splice(this.data.done.indexOf(id));
        }
        // If done, add
        if (done) {
            this.data.done.push(id);
        }
    }

    waitForDiff()
    {
        this.waitDiffAttempts++;

        let diffStart = $("#diffStart" + this.id);
        if (diffStart.length === 0) {
            if (this.waitDiffAttempts >= this.DIFF_DATA_MAX_ATTEMPTS) {
                this.message("Can't find diff data");
                return;
            }
            this.message(`Waiting for diff data, attempt ${this.waitDiffAttempts}`);
            window.setTimeout(this.waitForDiff.bind(this), this.DIFF_DATA_ATTEMPTS_DELAY_MS);
            return;
        }
        this.message("Diff data ready, analyzing");

        // Go over all siblings of diffStart;
        let row = diffStart;
        let diff = null;
        this.diffs = [];
        while (true) {
            row = row.next();
            if (row.length === 0) {
                break;
            }
            if (row.hasClass("comment-row")) {
                // Ignore comments
                continue;
            }
            if (row.hasClass("is-diff"))
            {
                if (!diff) {
                    // New diff
                    diff = new CDMDiff();
                }
                // Update diff
                diff.addRow(row);
            } else if (diff) {
                this.diffs.push(diff);
                this.updateDiff(diff);
                // Finish diff
                diff = null;
            }
        }
        this.message("Diff data analyzed");
        this.updateStats();
    }

    message(str)
    {
        console.log("Message: " + str);
        $("#" + this.messageId).html(`<span class="cdm-message-text">${str}</span>`);
    }

    updateStats()
    {
        let total = this.diffs.length;
        let done = this.data.done.length;
        let todo = total - done;

        $("#" + this.statsId).html(`
CrucibleDiffMarker: &nbsp; ${total} diffs in total. 
&nbsp;&nbsp;
<img src="${this.greenUrl}" width="16" height="16"/>
  <span class="cdm-stats-text">${done} diffs done.</span>
&nbsp;&nbsp;
<img src="${this.redUrl}" width="16" height="16"/>
  <span class="cdm-stats-text"> ${todo} diffs to do.</span>
`);
    }

    updateDiff(diff)
    {
        let id = diff.getId();
        let isDone = this.isDone(id);
        let img = isDone ? this.greenUrl : this.redUrl;
        diff.rows[0].find(".tetrisColumn").html(`<img src="${img}" width="16" height="16" class="${id}"/>`);
        let rightCell = diff.rows[0].find(".diffLineNumbersB:first");
        rightCell.html(`<img src="${img}" width="16" height="16" class="${id}"/>`);
        rightCell.addClass("tetrisColumn");
        for (let r = 0; r < diff.rows.length; r++) {
            let row = diff.rows[r];
            let elems = row.find("span, .lineContent , .diffContentA , .diffContentB , .diffLineNumbersA , .diffLineNumbersB");
            if (isDone) {
                elems.addClass("cdm-hidden");
            } else {
                elems.removeClass("cdm-hidden");
            }
        }

        let elems = document.getElementsByClassName(id);
        for (let e = 0; e < elems.length; e++) {
            elems[e].addEventListener("click", this.flip.bind(this, diff));
        }

        this.updateStats();
    }

    flip(diff)
    {
        let id = diff.getId();
        this.setDone(id, !this.isDone(id));
        this.updateDiff(diff);

        this.initDataSave();
    }
}

let cdm = new CDM();
cdm.start();

