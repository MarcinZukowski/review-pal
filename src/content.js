/* Crucible Diff Marker */

/* A single diff data */
class CDMDiff
{
    constructor()
    {
        this.left_from = 0;
        this.left_to = 0;
        this.right_from = 0;
        this.right_to = 0;
        this.rows = [];
    }
    addRow(row)
    {
        let [left, right] = CDMDiff.getRowRanges(row);
        this.left_from = this.left_from || left;
        this.left_to = left || this.left_to;

        this.right_from = this.right_from || right;
        this.right_to = right || this.right_to;

        this.rows.push(row);
    }
    getId()
    {
        return CDMDiff.createId(this.left_from, this.right_from);
    }
    toString()
    {
        return `Diff( left: ${this.left_from}-${this.left_to} right: ${this.right_from}-${this.right_to} )`;
    }

    // Does this diff include a given row (based on its left-right row ranges)
    includes(left, right)
    {
        function helper(nr, from, to) {
            return nr === 0 || (from > 0 && nr >= from && nr <= to);
        }
        return helper(left, this.left_from, this.left_to) && helper(right, this.right_from, this.right_to);
    }

    static getRowRanges(row)
    {
        let left = row.attr("data-from") || 0;
        let right = row.attr("data-to") || 0;
        return [left, right];
    }
    static createId(left, right)
    {
        return `diff_${left}_${right}`;
    }
    static getRowId(row)
    {
        let [left, right] = CDMDiff.getRowRanges(row);
        return CDMDiff.createId(left, right);
    }
}

/* Main class */
class CDM
{
    DIFF_DATA_MAX_ATTEMPTS = 30;
    DIFF_DATA_ATTEMPTS_DELAY_MS = 1000;
    LABEL = `<a class="cdm-label" href="https://github.com/MarcinZukowski/crucible-diff-marker">CrucibleDiffMarker</a>`;

    constructor()
    {
        this.data = null;
        this.redUrl = chrome.runtime.getURL("images/red-128.png");
        this.greenUrl = chrome.runtime.getURL("images/green-128.png");
    }

    start()
    {
        $(window).on('hashchange', this.hashChanged.bind(this));
        $(window).on("mousedown", this.middleClick.bind(this));
        this.hashChanged();
    }

    findDiffWith(left, right)
    {
        for (let d = 0; d < this.diffs.length; d++) {
            let diff = this.diffs[d];
            if (diff.includes(left, right)) {
                return diff;
            }
        }
        console.error(`Can't find row for ${left}_${right}, diffs=${this.diffs}`);
    }

    middleClick(ev)
    {
        let target = $(ev.target);
        // Only handle middle-click on diff Lines
        if (!(ev.which === 2 && target.parents(".sourceLine.is-diff").length)) {
            return true;
        }
        // Find parent TR
        let row = target.parents("tr");

        // Get its id
        let [left, right] = CDMDiff.getRowRanges(row);
        let rowId = CDMDiff.createId(left, right);

        // Find its diff
        let diff = this.findDiffWith(left, right);

        // Always mark the break as not done
        this.setDone(rowId, false);

        // See if the break exists already or not
        let breakIdx = this.data.breaks.indexOf(rowId);
        let msg;
        if (breakIdx >= 0)
        {
            // Existing break, remove it
            this.data.breaks.splice(breakIdx, 1);
            this.hideDiffHeader(diff);
            msg = "Diff-break removed";
        }
        else
        {
            if (diff.getId() === rowId) {
                // Ignore, can't break on the first line.
                this.message("Can't break on the first line!");
                return true;
            }
            // New break, add it
            this.data.breaks.push(rowId);
            msg = "Diff-break created";
        }
        this.analyzeDiffs();
        this.message(msg);
        this.initDataSave(false)

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
        this.counterId = "cdm-counter-" + id;

        this.initBar();

        // Load data for this file diff
        this.initDataLoad();
    }

    initBar()
    {
        let bar = $("#"+this.barId);
        if (bar.length === 0) {
            // Create a new bar
            let fci = $("#frx-context-info-" + this.id);
            if (fci.length === 0) {
                console.error("Can't find frx-context-info");
                return;
            }
            fci.after(`
<div class="cdm-bar" id="${this.barId}">
<span class="cdm-stats" id="${this.statsId}">${this.LABEL}</span>
<span class="cdm-tools"">
    
      <span class="cdm-button cdm-clearAll"><img src="${this.redUrl}" width="20" height="20"/>Clear all</span>
      <span class="cdm-button cdm-setAll"><img src="${this.greenUrl}" width="20" height="20"/> Mark all done</span>
</span>
<span class="cdm-message" id="${this.messageId}"></span>
</div>
`);
            bar = $("#"+this.barId);

            $("span.cdm-button").click(this.buttonPressed.bind(this));
        }
        this.bar = bar;
    }

    initCounter()
    {
        let counter = $("#"+this.counterId);
        if (counter.length === 0) {
            // Create a new counter
            let fcc = $("#frxCommentCount" + this.id);
            if (fcc.length === 0) {
                console.error("Can't find frx-comment-count");
                return;
            }
            fcc.after(`<span id="${this.counterId}" class="aui-badge cdm-counter"></span>`);
            counter = $("#"+this.counterId);
        }
        this.counter = counter;
    }


    buttonPressed(event)
    {
        let target = event.delegateTarget;
        let set = $(target).hasClass("cdm-setAll");
        for (let i = 0; i < this.diffs.length; i++) {
            let diff = this.diffs[i];
            this.setDone(diff.getId(), set);
            this.updateDiff(diff);
        }
        this.updateStats();
        this.initDataSave();
    }

    initDataLoad()
    {
        chrome.storage.local.get([this.dataKey], this.dataLoaded.bind(this));
    }

    dataLoaded(result)
    {
        this.message("LOADED!");

        console.log("Loaded data: " + JSON.stringify(result));

        this.data = result[this.dataKey];
        if (!this.data) {
            // Initialize to an empty set
            this.data = {
                done: []
            }
        }
        if (!this.data.breaks) {  // Handle old datasets
            this.data.breaks = [];
        }

        this.waitDiffAttempts = 0;
        this.waitForDiff();
    }

    initDataSave(print = true)
    {
        let toSave = {};
        toSave[this.dataKey] = this.data;
        chrome.storage.local.set(toSave, this.dataSaved.bind(this, print));

    }

    dataSaved(print)
    {
        if (print) {
            this.message("Data saved!");
        }
    }

    isDone(id)
    {
        return this.data.done.includes(id);
    }

    setDone(id, done)
    {
        // Always remove
        if (this.data.done.indexOf(id) >= 0) {
            this.data.done.splice(this.data.done.indexOf(id), 1);
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

        this.analyzeDiffs();
    }

    analyzeDiffs()
    {
        let diffStart = $("#diffStart" + this.id);

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
            let isBreak = this.data.breaks.indexOf(CDMDiff.getRowId(row)) >= 0;
            let isDiff = row.hasClass("is-diff");
            if (!isDiff || isBreak) {
                // Possibly an end of a diff
                if (diff) {
                    this.diffs.push(diff);
                    this.updateDiff(diff);
                    // Finish diff
                    diff = null;
                }
            }
            if (isDiff) {
                if (!diff) {
                    // New diff
                    diff = new CDMDiff();
                }
                // Update diff
                diff.addRow(row);
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
${this.LABEL}: &nbsp; ${total} diffs in total. 
&nbsp;&nbsp;
<img src="${this.greenUrl}" width="16" height="16"/>
  <span class="cdm-stats-text cdm-stats-done">${done} diffs done.</span>
&nbsp;&nbsp;
<img src="${this.redUrl}" width="16" height="16"/>
  <span class="cdm-stats-text cdm-stats-todo"> ${todo} diffs to do.</span>
`);

        // Update the counter on the left
        this.initCounter();
        this.counter.html(`${done}/${total}`);
        this.counter.removeClass("cdm-counter-todo cdm-counter-done");
        this.counter.addClass(done === total ? "cdm-counter-done" : "cdm-counter-todo");

        if (done === total) {
            // The file is done, mark as read if unread
            let frx = $("#frxControls" + this.id);
            if (frx.hasClass("unread")) {
                console.log("Triggering click on", frx);
                frx.find(".leaveUnread").trigger("click");
            }
        }

        $(".cdm-stats-todo").click(this.gotoNext.bind(this, false));
        $(".cdm-stats-done").click(this.gotoNext.bind(this, true));
    }

    gotoNext(shouldBeDone)
    {
        let container = $("#sourceTable" + this.id);
        let containerOffset = container.offset().top - container.scrollTop();
        let currentTop = $(window).scrollTop();
        let foundDiff = null;
        let foundTop = 0;
        for (let d = 0; d < this.diffs.length; d++) {
            let diff = this.diffs[d];
            if (this.isDone(diff.getId()) === shouldBeDone) {
                let top = diff.rows[0].offset().top - containerOffset;
                // Accept first matching row, or first matching after the current window position.
                if (foundDiff === null || top > currentTop) {
                    foundDiff = diff ;
                    foundTop = top;
                    if (top > currentTop) {
                        break;
                    }
                }
            }
        }
        if (foundDiff !== null) {
            // Found something, scroll there
            this.message(`Scrolling to ${foundDiff.getId()}`);
            $(window).scrollTop(foundTop);
            // Add animation and removal of it after it's done
            foundDiff.rows[0].addClass("cdm-jump");
            window.setTimeout(function() { this.removeClass("cdm-jump"); }.bind(foundDiff.rows[0]), 500);
        } else {
            this.message(`No ${shouldBeDone? "" : "un"}reviewed diffs!`);
        }
        return false;
    }

    hideDiffHeader(diff)
    {
        diff.rows[0].find(".tetrisColumn").html("&nbsp;");
        let rightCell = diff.rows[0].find(".diffLineNumbersB:first");
        rightCell.html("&nbsp;");
        rightCell.removeClass("tetrisColumn");
        diff.rows[0].removeClass("cdm-forcedBreak");
    }

    addDiffHeader(diff)
    {
        let id = diff.getId();
        let isDone = this.isDone(id);
        let img = isDone ? this.greenUrl : this.redUrl;
        diff.rows[0].find(".tetrisColumn").html(`<img src="${img}" width="16" height="16" class="${id}"/>`);
        let rightCell = diff.rows[0].find(".diffLineNumbersB:first");
        rightCell.html(`<img src="${img}" width="16" height="16" class="${id}"/>`);
        // Make it non-clickable
        rightCell.addClass("tetrisColumn");
        if (this.data.breaks.indexOf(id) >= 0) {
            diff.rows[0].addClass("cdm-forcedBreak");
        }
    }

    updateDiff(diff)
    {
        this.addDiffHeader(diff);
        let id = diff.getId();
        let isDone = this.isDone(id);
        for (let r = 0; r < diff.rows.length; r++) {
            let row = diff.rows[r];
            let elems = row.find("span, .lineContent , .diffContentA , .diffContentB , .diffLineNumbersA , .diffLineNumbersB");
            if (isDone) {
                elems.addClass("cdm-hidden");
            } else {
                elems.removeClass("cdm-hidden");
            }
        }

        $("." + id).click(this.flip.bind(this, diff));
    }

    flip(diff)
    {
        let id = diff.getId();
        this.setDone(id, !this.isDone(id));
        this.updateDiff(diff);
        this.updateStats();

        this.initDataSave();
    }
}

let cdm = new CDM();
cdm.start();

