class BackendCrucible
{
    DIFF_DATA_MAX_ATTEMPTS = 30;
    DIFF_DATA_ATTEMPTS_DELAY_MS = 1000;

    CLASS_JUMP = "cdm-jump";

    constructor()
    {
        console.log("Initializing BackendCrucible");
    }

    getParentRow(target)
    {
        if (target.parents(".sourceLine.is-diff").length === 0) {
            return null;
        }

        // Find parent TR
        return target.parents("tr").get()[0];
    }

    createDiffLine(row)
    {
        let tag = "";
        let left = Number($(row).attr("data-from")) || 0;
        let right = Number($(row).attr("data-to")) || 0;
        return new DiffLine(tag, left, right, row);
    }

    updateDiff(diff)
    {
        this.addDiffHeader(diff);
        let id = diff.getId();
        let isDone = dmcore.isDone(id);
        for (let r = 0; r < diff.lines.length; r++) {
            let row = $(diff.lines[r].row);
            let elems = row.find("span, .lineContent , .diffContentA , .diffContentB , .diffLineNumbersA , .diffLineNumbersB");
            if (isDone) {
                elems.addClass("cdm-hidden");
            } else {
                elems.removeClass("cdm-hidden");
            }
        }

        $("." + id).on("click", dmcore.flip.bind(dmcore, diff));
    }

    hideDiffHeader(diff)
    {
        let row0 = $(diff.lines[0].row);
        row0.find(".tetrisColumn").html("&nbsp;");
        let rightCell = row0.find(".diffLineNumbersB:first");
        rightCell.html("&nbsp;");
        rightCell.removeClass("tetrisColumn");
        row0.removeClass("cdm-forcedBreak");
    }

    addDiffHeader(diff)
    {
        let id = diff.getId();
        let isDone = dmcore.isDone(id);
        let imgHTML = isDone ? dmcore.greenHTML: dmcore.redHTML;
        let row0 = $(diff.lines[0].row);
        row0.find(".tetrisColumn").html(`<img ${imgHTML} width="16" height="16" class="${id}"/>`);

        // For side-by-side, add markers also in the right column
        if (!this.unified) {
            let rightCell = row0.find(".diffLineNumbersB:first");
            rightCell.html(`<img ${imgHTML} width="16" height="16" class="${id}"/>`);
            // Make it non-clickable
            rightCell.addClass("tetrisColumn");
        }

        if (dmcore.data.breaks.indexOf(id) >= 0) {
            row0.addClass("cdm-forcedBreak");
        }
    }

    markFileAsReviewed(id)
    {
        // The file is done, mark as read if unread
        let frx = $("#frxControls" + this.id);
        if (frx.hasClass("unread")) {
            console.log("Triggering click on", frx);
            frx.find(".leaveUnread").trigger("click");
        }
    }

    isUnified()
    {
        let elem = $(`#view_opts${this.id} .frx-diff-layout-opt`)[0];
        return $(elem).hasClass("selected");
    }

    analyzeDiffs()
    {
        this.unified = this.isUnified();

        let diffStart = $("#diffStart" + dmcore.id);

        // Go over all siblings of diffStart;
        let row = diffStart;
        let diff = null;
        dmcore.diffs = [];
        while (true) {
            row = row.next();
            if (row.length === 0) {
                break;
            }
            if (row.hasClass("comment-row")) {
                // Ignore comments
                continue;
            }
            let diffLine = this.createDiffLine(row);
            let isBreak = dmcore.data.breaks.indexOf(diffLine.id) >= 0;
            let isDiff = row.hasClass("is-diff");
            if (!isDiff || isBreak) {
                // Possibly an end of a diff
                if (diff) {
                    dmcore.diffs.push(diff);
                    dmcore.updateDiff(diff);
                    // Finish diff
                    diff = null;
                }
            }
            if (isDiff) {
                if (!diff) {
                    // New diff
                    diff = new DiffBlock();
                }
                // Update diff
                diff.addLine(diffLine);
            }
        }
    }

    deriveId()
    {
        let hash = window.location.hash;
        console.log("hashchanged: " + hash);
        if (!hash.startsWith("#CFR")) {
            console.log("No #CFR, exiting");
            return;
        }
        dmcore.id = hash.substr(5);
    }

    initBar()
    {
        console.log("Adding bar");
        let fci = $("#frx-context-info-" + dmcore.id);
        if (fci.length === 0) {
            console.error("Can't find frx-context-info");
            return;
        }
        fci.after(`<div class="cdm-bar" id="${dmcore.barId}"/>`);

        let bar = $("#"+dmcore.barId);
        bar.html(`
<span class="cdm-stats" id="${dmcore.statsId}">${dmcore.LABEL}</span>
<span class="cdm-tools"">
    
      <span class="cdm-button cdm-clearAll"><img ${dmcore.redHTML} width="20" height="20"/>Clear all</span>
      <span class="cdm-button cdm-setAll"><img ${dmcore.greenHTML} width="20" height="20"/> Mark all done</span>
</span>
<span class="cdm-message" id="${dmcore.messageId}"></span>
`);
        $("span.cdm-button").click(dmcore.buttonPressed.bind(dmcore));

    }

    waitForDiffHelper(callback)
    {
        this.waitDiffAttempts++;

        let diffStart = $("#diffStart" + dmcore.id);
        if (diffStart.length === 0) {
            if (this.waitDiffAttempts >= this.DIFF_DATA_MAX_ATTEMPTS) {
                dmcore.message("Can't find diff data");
                return;
            }
            dmcore.message(`Waiting for diff data, attempt ${this.waitDiffAttempts}`);
            window.setTimeout(this.waitForDiffHelper.bind(this, callback), this.DIFF_DATA_ATTEMPTS_DELAY_MS);
            return;
        }

        // Detect node changes to be able to re-render our stuff
        $("#frxouter" + dmcore.id).on("DOMNodeInserted", this.nodeInserted.bind(this));

        callback();
    }

    waitForDiff(callback)
    {
        this.waitForDiffAttempts = 0;
        this.waitForDiffHelper(callback);
    }

    nodeInserted(ev)
    {
        // this element seems to be the last one inserted
        console.log(ev.target);
        if ($(ev.target).hasClass("floating-scrollbar")) {
            dmcore.initBar();
            dmcore.analyzeDiffs();
        }
    }

    updateCounter(done, total)
    {
        let counter = $("#"+dmcore.counterId);
        if (counter.length === 0) {
            // Create a new counter
            let fcc = $("#frxCommentCount" + dmcore.id);
            if (fcc.length === 0) {
                console.error("Can't find frx-comment-count");
                return;
            }
            fcc.after(`<span id="${this.counterId}" class="aui-badge cdm-counter"></span>`);
            counter = $("#"+dmcore.counterId);
        }

        counter.html(`${done}/${total}`);
        counter.removeClass("cdm-counter-todo cdm-counter-done");
        counter.addClass(done === total ? "cdm-counter-done" : "cdm-counter-todo");
    }

    updateStats(total, totalLines, done, doneLines, todo, todoLines)
    {
        $("#" + dmcore.statsId).html(`
${dmcore.LABEL}: &nbsp; ${total} diffs (${totalLines} lines) in total. 
&nbsp;&nbsp;
  <span class="cdm-stats-text cdm-stats-done">
    <img ${dmcore.greenHTML} width="16" height="16"/>
    ${done} diffs (${doneLines} lines) done.
  </span>
&nbsp;&nbsp;
  <span class="cdm-stats-text cdm-stats-todo">
    <img ${dmcore.redHTML} width="16" height="16"/> 
    ${todo} diffs (${todoLines} lines) to do.
  </span>
`);
    }

    getDiffContainerOffset()
    {
        let container = $("#sourceTable" + dmcore.id);
        let containerOffset = container.offset().top - container.scrollTop();
        return containerOffset;
    }
}