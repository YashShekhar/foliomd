import { makeChapter, type Book } from "./book";

const entries = [
  [
    "01-a-little-less-noise.md",
    `# A little less noise

We live in a world that rarely pauses. There is always another notification, another open tab, another thing asking for a small piece of our attention.

But some things are worth slowing down for.

A good book. A half-formed idea. The quiet satisfaction of understanding something a little better than you did yesterday. This is a small collection of thoughts about making room for those things.

> A little less noise makes room for a little more wonder.
>
> — A note to begin with

## An invitation to slow down

You don’t have to read this from beginning to end. Start with a chapter that catches your eye. Leave a thought unfinished. Come back when you’re ready.

Reading isn’t a race to the last page. It’s a conversation between what’s on the page and what’s on your mind.

### A little room for thought

Try this the next time you sit down to read:

1. Find somewhere comfortable.
2. Put the things that interrupt you out of reach.
3. Read one page without thinking about the next.

That’s all. You don’t need a perfect routine. You just need a place to begin.

## Make yourself at home

This is **foliomd**, a quiet home for your Markdown files. Open a folder and your notes, essays, or documentation become chapters of a book.

Use the chapter list to find your way, or follow the next chapter at the bottom of each page. Adjust the type to suit your eyes. Your place is remembered on this browser, so you can pick up where you left off.

*A little less noise. A little more room for the words.*
`,
  ],
  [
    "02-the-practice-of-attention.md",
    `# The practice of attention

Attention is one of the few things that is entirely ours to give. Where we place it shapes the texture of our days.

## Notice the ordinary

The light moving across a wall. The sound of a familiar voice. A sentence that says something you have felt but never quite found the words for.

These things are easy to miss when we’re only looking for the extraordinary.

> To pay attention is to let something matter for a moment.

## One thing at a time

Multitasking often feels productive. But there is another kind of progress: staying with a thought long enough to find out where it leads.

- Read a chapter with just one tab open.
- Write a paragraph without editing the first sentence.
- Listen to a whole song without choosing the next one.

Small practices make space for deeper attention.

## A question to carry with you

What deserved your attention today? What received it instead?

You don’t need to change everything. Just notice the difference.
`,
  ],
  [
    "03-a-place-for-your-thoughts.md",
    `# A place for your thoughts

A notebook is a generous thing. It lets an idea arrive before it knows what it wants to be.

## Keep it simple

Plain text has a certain staying power. Your words belong to you, in files you can read, move, and keep.

Markdown adds just enough structure:

\`\`\`markdown
# An idea worth keeping

A few words to begin with.

## What I’m wondering
- How does this connect to something I already know?
- What would happen if I tried it?

> A thought to come back to.
\`\`\`

## Let a collection become a book

Put related notes in a folder. Give them names that suggest an order. A beginning, a few steps along the way, somewhere to arrive.

| File | Chapter |
| --- | --- |
| 01-beginning.md | Beginning |
| 02-exploration.md | Exploration |
| 03-reflection.md | Reflection |

foliomd sorts numbered filenames naturally, so chapter 2 comes before chapter 10. Nested folders work too.

You can follow [the next chapter](04-reading-with-intention.md), or return to [the beginning](01-a-little-less-noise.md).
`,
  ],
  [
    "04-reading-with-intention.md",
    `# Reading with intention

Not every book needs the same kind of reading. Sometimes you’re searching for an answer. Sometimes you’re following a story. Sometimes you’re simply enjoying the company of another mind.

## Before the first page

Ask yourself what brought you here. Curiosity is a perfectly good answer.

There is no test at the end. You can disagree with what you read. You can change your mind halfway through.

## Leave a little space

When a sentence stays with you, pause. Let your own thoughts catch up.

Try keeping a small note alongside your reading:

- **Something new:** an idea you hadn’t encountered.
- **Something familiar:** a connection to your own experience.
- **Something unresolved:** a question to take further.

## Read again

A second reading is never quite the same book. The words haven’t changed, but you have.

That’s part of what makes a good collection worth keeping close.
`,
  ],
  [
    "05-the-beauty-of-small-things.md",
    `# The beauty of small things

A margin wide enough to rest your eyes. A cup that fits comfortably in your hands. A tool that does what you need and then gets out of the way.

Small things are not always small in their effect.

## Care is visible

We notice when something has been made thoughtfully, even if we can’t say exactly why. The spacing feels right. The words are clear. The next step is where we expect it to be.

Good design leaves a little less for us to think about, so we can think about what matters.

## Enough

There is a particular pleasure in having enough. Enough light to read by. Enough time for a walk. Enough understanding to ask a better question.

More isn’t always the answer. Sometimes the answer is to see what is already here.

---

*Make something small. Make it with care. See what happens.*
`,
  ],
  [
    "06-building-a-reading-ritual.md",
    `# Building a reading ritual

A ritual is a small promise you make to yourself. It doesn’t have to be elaborate. It just has to be yours.

## Find your moment

Maybe it’s ten minutes before the rest of the house wakes up. Maybe it’s the train ride home, or the quiet part of a Sunday afternoon.

Choose a time that already has a little room in it.

## Make it easy to begin

- Keep your book somewhere you’ll see it.
- Leave yourself a note about where you stopped.
- Choose a small enough goal that you can meet it on a difficult day.

Five minutes counts. One page counts. Coming back counts.

## Allow the ritual to change

Your life won’t always look the same, and neither will your reading. A practice that bends is often a practice that lasts.

Let it be something that supports you.
`,
  ],
  [
    "07-a-new-chapter.md",
    `# A new chapter

Every collection starts with a single page.

Maybe yours is a set of notes you’ve been meaning to revisit. A draft of something you’re writing. A folder of ideas that never quite had a home.

## Bring your own words

Select **Open folder** in the sidebar and choose a folder of Markdown files. foliomd will gather the chapters, put them in order, and give them room to breathe.

### A few useful details

- Files ending in \`.md\`, \`.markdown\`, and \`.mdown\` are supported.
- Subfolders are included, with numbered filenames sorted naturally.
- Relative images and links between chapters work within the selected folder.
- Your files are read locally. There is no account and no upload.
- Reopen your folder after a refresh; foliomd remembers your reading position on this browser.

## Over to you

There’s no right way to fill a book. Start with what you have. Follow what interests you.

The next chapter is yours.
`,
  ],
];

export const demoBook: Book = {
  id: "folio-demo-v1",
  title: "The quiet art of paying attention",
  folder: "a-mindful-life",
  chapters: entries.map(([path, content]) => makeChapter(path, content)),
  assets: new Map(),
  demo: true,
};
