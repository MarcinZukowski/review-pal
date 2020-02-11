// Container for a single diff line

class DiffLine
{
    constructor(tag, left, right, row)
    {
        this.tag = tag;
        this.left = left;
        this.right = right;
        this.row = row;
        this.id = DiffLine.createId(left, right, tag);
    }

    static createId(left, right, tag)
    {
        tag = tag || "";
        return `diff_${left}_${right}_${tag}`;
    }
}
