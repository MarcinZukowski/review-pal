class CrucibleBackend
{
    DIFF_DATA_MAX_ATTEMPTS = 30;
    DIFF_DATA_ATTEMPTS_DELAY_MS = 1000;

    constructor()
    {
        console.log("Initializing CrucibleBackend");
    }

    /** Return [isDiff, left, right] */
    getMiddleClickInfo(target)
    {
        if (target.parents(".sourceLine.is-diff").length === 0) {
            return [false];
        }

        // Find parent TR
        let row = target.parents("tr");

        let [left, right] = this.getRowRanges(row);
        return [true, left, right];
    }

    getRowRanges(row)
    {
        let left = Number(row.attr("data-from")) || 0;
        let right = Number(row.attr("data-to")) || 0;
        return [left, right];
    }

    updateDiff(diff)
    {
        this.addDiffHeader(diff);
        let id = diff.getId();
        let isDone = dmcore.isDone(id);
        for (let r = 0; r < diff.rows.length; r++) {
            let row = diff.rows[r];
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
        diff.rows[0].find(".tetrisColumn").html("&nbsp;");
        let rightCell = diff.rows[0].find(".diffLineNumbersB:first");
        rightCell.html("&nbsp;");
        rightCell.removeClass("tetrisColumn");
        diff.rows[0].removeClass("cdm-forcedBreak");
    }

    addDiffHeader(diff)
    {
        let id = diff.getId();
        let isDone = dmcore.isDone(id);
        let imgHTML = isDone ? dmcore.greenHTML: dmcore.redHTML;
        diff.rows[0].find(".tetrisColumn").html(`<img ${imgHTML} width="16" height="16" class="${id}"/>`);

        // For side-by-side, add markers also in the right column
        if (!this.unified) {
            let rightCell = diff.rows[0].find(".diffLineNumbersB:first");
            rightCell.html(`<img ${imgHTML} width="16" height="16" class="${id}"/>`);
            // Make it non-clickable
            rightCell.addClass("tetrisColumn");
        }

        if (dmcore.data.breaks.indexOf(id) >= 0) {
            diff.rows[0].addClass("cdm-forcedBreak");
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

        // Clean previously set breaks
//        $(".cdm-forcedBreak").removeClass("cdm-forcedBreak");

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
            let diffLine = parent.createDiffLine(row);
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
                diff.addRow(row);
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
        let fci = $("#frx-context-info-" + dmcore.id);
        if (fci.length === 0) {
            console.error("Can't find frx-context-info");
            return;
        }
        console.log("Adding bar");
        fci.after(`<div class="cdm-bar" id="${dmcore.barId}"/>`);
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

        callback();
    }

    waitForDiff(callback)
    {
        this.waitForDiffAttempts = 0;
        this.waitForDiffHelper(callback);
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


}

class GitHubBackend
{
    constructor()
    {
        console.log("Initializing GitHubBackend");
    }

    deriveId()
    {
        let href = window.location.href;
        let m = href.match(/pull\/(.*)\/files/);
        if (!m) {
            console.log("No id, exiting");
            return;
        }
        dmcore.id = m[1];
    }

    initBar()
    {
        let tb = $(".pr-toolbar");
        if (tb.length === 0) {
            console.error("Can't find pr-toolbar");
            return;
        }
        console.log("Adding bar");
        tb.append(`<div class="cdm-bar" id="${dmcore.barId}"/><br/>`);
    }

    waitForDiff(callback)
    {
        callback();
    }

    getRowRanges(row)
    {
        let left = Number($(row.cells[0]).attr("data-line-number")) || 0;
        let right = Number($(row.cells[2]).attr("data-line-number")) || 0;
        return [left, right];
    }

    analyzeDiffs()
    {
        dmcore.diffs = [];
        let diff = null;
        let parent = this;

        let func = function(index, row) {
            let lval = row.cells[1];
            let rval = row.cells[3];

            let diffLine = parent.createDiffLine(row);
            let isBreak = dmcore.data.breaks.indexOf(diffLine.id) >= 0;
            let isDiff = $(lval).hasClass("blob-code-deletion")
                || $(rval).hasClass("blob-code-addition");

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
                    diff = new DiffBlock(diffLine.tag);
                }
                // Update diff
                diff.addLine(diffLine);
            }
        };
        let hunks = $("[data-hunk]");
        hunks.each(func);

        console.log(dmcore.diffs);
        return;
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
        $(diff.lines[0].row).find(".js-linkable-line-number").html("");
        $(diff.lines[0].row).find(".cdm-forcedBreak").removeClass("cdm-forcedBreak");
    }

    addDiffHeader(diff)
    {
        let id = diff.getId();
        let isDone = dmcore.isDone(id);
        let imgHTML = isDone ? dmcore.greenHTML: dmcore.redHTML;
        $(diff.lines[0].row)
            .find(".js-linkable-line-number")
            .html(`
<img ${imgHTML} width="20" height="20" class="${id}"
style="position: relative; top: 0px; right: 20px; opacity: 80%; background-color: white"
/>
`);

        if (dmcore.data.breaks.indexOf(id) >= 0) {
            $(diff.lines[0].row).find("td").addClass("cdm-forcedBreak");
        }
    }

    updateCounter(done, total)
    {
    }

    getParentRow(target)
    {
        if (target.parents("[data-hunk]").length === 0) {
            return null;
        }

        // Find parent TR
        return target.parents("tr").get()[0];
    }

    createDiffLine(row)
    {
        let tag = $(row).attr("data-hunk");
        let left = Number($(row.cells[0]).attr("data-line-number")) || 0;
        let right = Number($(row.cells[2]).attr("data-line-number")) || 0;
        return new DiffLine(tag, left, right, row);
    }
}
