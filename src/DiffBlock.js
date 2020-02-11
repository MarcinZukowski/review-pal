/* A single block of diff data */
class DiffBlock
{
    constructor(tag)
    {
        this.tag = tag || "";
        this.left_from = 0;
        this.left_to = 0;
        this.right_from = 0;
        this.right_to = 0;
        this.lines = [];
    }

    addLine(line)
    {
        let left = line.left;
        let right = line.right;
        this.left_from = this.left_from || left;
        this.left_to = left || this.left_to;

        this.right_from = this.right_from || right;
        this.right_to = right || this.right_to;

        this.lines.push(line);
    }

    getId()
    {
        return DiffLine.createId(this.left_from, this.right_from, this.tag);
    }

    toString()
    {
        return `Diff( left: ${this.left_from}-${this.left_to} right: ${this.right_from}-${this.right_to} tag: ${this.tag})`;
    }

    // Does this diff include a given line (based on its tag and left-right row ranges)
    includesLine(diffLine)
    {
        function helper(nr, from, to) {
            return nr === 0 || (from > 0 && nr >= from && nr <= to);
        }
        return this.tag === diffLine.tag
            && helper(diffLine.left, this.left_from, this.left_to)
            && helper(diffLine.right, this.right_from, this.right_to);
    }

    getNumLines()
    {
        return (this.left_from  > 0 ? 1 + this.left_to  - this.left_from  : 0)
            + (this.right_from > 0 ? 1 + this.right_to - this.right_from : 0);
    }
}
