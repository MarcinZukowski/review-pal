/* Main class */
class Core
{
    LABEL = `<a class="cdm-label" href="https://github.com/MarcinZukowski/crucible-diff-marker">CrucibleDiffMarker</a>`;

    constructor()
    {
        this.data = null;
        let redUrl = chrome.runtime.getURL("images/red-128.png");
        let greenUrl = chrome.runtime.getURL("images/green-128.png");
        this.redHTML = `src="${redUrl}" alt="(_)" `;
        this.greenHTML = `src="${greenUrl}" alt="(X)" `;

        console.log(window.location.href);
        if (window.location.href.search("github") >= 0) {
            this.backend = new BackendGitHub();
        } else {
            this.backend = new BackendCrucible();
        }
    }

    start()
    {
        $(window).on('hashchange', this.hashChanged.bind(this));
        $(window).on("mousedown", this.middleClick.bind(this));
        $(window).on("keypress", this.keyPressed.bind(this));
        this.hashChanged();
    }

    keyPressed(e)
    {
        if (!e.shiftKey) {
            return true;
        }
        if (e.key === "K") {
            this.gotoNext(undefined);
            return true;
        }
        if (e.key === "X") {
            if (this.lastFoundDiffIdx >= 0)
            {
                this.flip(this.diffs[this.lastFoundDiffIdx]);
            }
            else
            {
                this.message("No diff selected");
            }
        }
    }

    findDiffWith(diffLine)
    {
        for (let d = 0; d < this.diffs.length; d++) {
            let diff = this.diffs[d];
            if (diff.includesLine(diffLine)) {
                return diff;
            }
        }
        console.error(`Can't find row for ${left}_${right}, diffs=${this.diffs}`);
    }

    middleClick(ev)
    {
        let target = $(ev.target);

        // Only middle click
        if (ev.which !== 2) {
            return true;
        }

        // Check if it's a diff row
        let row = this.backend.getParentRow(target);
        if (! row) {
            return true;
        }

        let diffLine = this.backend.createDiffLine(row);
        let rowId = diffLine.id;

        // Find its diff
        let diff = this.findDiffWith(diffLine);

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
        this.lastFoundDiffIdx = -1;

        this.cleanData();

        this.id = null;

        this.backend.deriveId();

        if (this.id === null) {
            console.log("Can't derive change id, exiting");
            return;
        }

        console.log(`Using id: ${this.id}`);

        // Prepare some identifiers
        this.barId = "cdm-bar-" + this.id;
        this.statsId = "cdm-stats-" + this.id;
        this.messageId = "cdm-message-" + this.id;
        this.counterId = "cdm-counter-" + this.id;

        this.initBar();

        // Load data for this file diff
        this.initDataLoad();
    }

    initBar()
    {
        let bar = $("#"+this.barId);
        if (bar.length === 0) {
            // Create a new bar
            this.backend.initBar();
            let bar = $("#"+this.barId);
            bar.html(`
<span class="cdm-stats" id="${this.statsId}">${this.LABEL}</span>
<span class="cdm-tools"">
    
      <span class="cdm-button cdm-clearAll"><img ${this.redHTML} width="20" height="20"/>Clear all</span>
      <span class="cdm-button cdm-setAll"><img ${this.greenHTML} width="20" height="20"/> Mark all done</span>
</span>
<span class="cdm-message" id="${this.messageId}"></span>
`);
            $("span.cdm-button").click(this.buttonPressed.bind(this));
        }
        this.bar = bar;
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

    cleanData()
    {
        this.diffs = [];
        this.data = null;
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

        // Detect node changes to be able to re-render our stuff
        $("#frxouter" + this.id).on("DOMNodeInserted", this.nodeInserted.bind(this));


        this.waitForDiff();
    }

    nodeInserted(ev)
    {
        // this element seems to be the last one inserted
        if ($(ev.target).hasClass("floating-scrollbar")) {
            this.initBar();
            this.analyzeDiffs();
        }
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
        this.backend.waitForDiff(this.diffReady.bind(this));
    }

    diffReady()
    {
        this.message("Diff data ready, analyzing");
        this.analyzeDiffs();
    }

    analyzeDiffs()
    {
        if (!this.data) {
            // Sometimes we get here when the data is not ready yet.
            return;
        }

        this.backend.analyzeDiffs();

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

        let totalLines = 0, doneLines = 0;
        for (let i = 0; i < this.diffs.length; i++)
        {
            totalLines += this.diffs[i].getNumLines();
            if (this.isDone(this.diffs[i].getId()))
            {
                doneLines += this.diffs[i].getNumLines();
            }
        }
        let todoLines = totalLines - doneLines;

        $("#" + this.statsId).html(`
${this.LABEL}: &nbsp; ${total} diffs (${totalLines} lines) in total. 
&nbsp;&nbsp;
  <span class="cdm-stats-text cdm-stats-done">
    <img ${this.greenHTML} width="16" height="16"/>
    ${done} diffs (${doneLines} lines) done.
  </span>
&nbsp;&nbsp;
  <span class="cdm-stats-text cdm-stats-todo">
    <img ${this.redHTML} width="16" height="16"/> 
    ${todo} diffs (${todoLines} lines) to do.
  </span>
`);

        // Update the counter on the left
        this.backend.updateCounter(done, total);

        if (done === total) {
            this.backend.markFileAsReviewed(this.id)
        }

        $(".cdm-stats-todo").click(this.gotoNext.bind(this, false));
        $(".cdm-stats-done").click(this.gotoNext.bind(this, true));
    }

    /**
     *  @param shouldBeDone  If defined, only diffs that are done (true) or not done (false)
     *                       are chosen.
     *                       If undefined, all diffs are chosen.
     */
    gotoNext(shouldBeDone)
    {
        $(".cdm-jump").removeClass("cdm-jump");

        let startIdx = this.lastFoundDiffIdx;

        let container = $("#sourceTable" + this.id);
        let containerOffset = container.offset().top - container.scrollTop();
        let currentTop = $(window).scrollTop();
        let foundDiff = null;
        let foundTop = 0;
        let count = this.diffs.length;
        for (let d = 1; d < count; d++) {
            let idx = (d + startIdx) % count;
            let diff = this.diffs[idx];
            if (shouldBeDone === undefined || this.isDone(diff.getId()) === shouldBeDone) {
                let top = diff.rows[0].offset().top - containerOffset;
                // Accept first matching row, or first matching after the current window position.
                if (foundDiff === null || top > currentTop) {
                    foundDiff = diff ;
                    foundTop = top;
                    this.lastFoundDiffIdx = idx;
                    if (top > currentTop) {
                        break;
                    }
                }
            }
        }
        if (foundDiff !== null) {
            // Found something, scroll there
            let prevTop = $(window).scrollTop();
            $(window).scrollTop(foundTop);
            let currTop = $(window).scrollTop();
            this.message(`Scrolling to ${foundDiff.getId()} (${prevTop} -> ${foundTop} -> ${currTop})`);
            // Add animation and removal of it after it's done
            foundDiff.rows[0].addClass("cdm-jump");
//            window.setTimeout(function() { this.removeClass("cdm-jump"); }.bind(foundDiff.rows[0]), 500);
        } else {
            this.message(`No ${shouldBeDone? "" : "un"}reviewed diffs!`);
            // this.lastFoundDiffIdx = -1;
        }
        return false;
    }

    flip(diff)
    {
        let id = diff.getId();
        this.setDone(id, !this.isDone(id));
        this.updateDiff(diff);
        this.updateStats();

        this.initDataSave();
    }

    // Forwards to backend
    updateDiff(diff) { this.backend.updateDiff(diff); }
    hideDiffHeader(diff) { this.backend.hideDiffHeader(diff); }
}

let dmcore = new Core();
dmcore.start();
