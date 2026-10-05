async function readEntry(entry: FileSystemEntry, parent = ""): Promise<File[]> {
  const path = `${parent}${entry.name}`;
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    Object.defineProperty(file, "webkitRelativePath", { value: path });
    return [file];
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const entries: FileSystemEntry[] = [];
    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (!batch.length) break;
      entries.push(...batch);
    }
    return (
      await Promise.all(
        entries
          .filter(
            (child) =>
              !child.name.startsWith(".") && child.name !== "node_modules",
          )
          .map((child) => readEntry(child, `${path}/`)),
      )
    ).flat();
  }
  return [];
}

export async function droppedFiles(data: DataTransfer) {
  const entries = Array.from(data.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => !!entry);
  if (!entries.length) return Array.from(data.files);
  // A synthetic root keeps independently dropped files and folders together.
  const root = entries.length === 1 && entries[0].isDirectory ? "" : "My book/";
  return (
    await Promise.all(entries.map((entry) => readEntry(entry, root)))
  ).flat();
}
