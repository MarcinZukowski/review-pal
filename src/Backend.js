class CrucibleBackend
{
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

}