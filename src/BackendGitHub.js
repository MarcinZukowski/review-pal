class BackendGitHub
{
    constructor()
    {
        console.log("Initializing BackendGitHub");
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

    isDiff(row)
    {
        let lval = row.cells[1];
        let rval = row.cells[3];
        return $(lval).hasClass("blob-code-deletion")
        || $(rval).hasClass("blob-code-addition");
    }

    analyzeDiffs()
    {
        dmcore.diffs = [];
        let diff = null;
        let parent = this;

        let func = function(index, row) {

            let diffLine = parent.createDiffLine(row);
            let isBreak = dmcore.data.breaks.indexOf(diffLine.id) >= 0;
            let isDiff = parent.isDiff(row);

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
        let row = target.parents("tr").get()[0];
        if (!this.isDiff(row)) {
            return null;
        }
        return row;
    }

    createDiffLine(row)
    {
        let tag = $(row).attr("data-hunk");
        let left = Number($(row.cells[0]).attr("data-line-number")) || 0;
        let right = Number($(row.cells[2]).attr("data-line-number")) || 0;
        return new DiffLine(tag, left, right, row);
    }
}
