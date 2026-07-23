import { describe, expect, it } from "vitest";
import { MemoryRepository } from "./workspace-memory-repository";

function profile(userId: string, displayName: string) {
  const now = new Date().toISOString();
  return { id: userId, userId, displayName, avatarUrl: null, jobRole: null, lastSeenAt: now, createdAt: now, updatedAt: now };
}

describe("chat repository", () => {
  it("prevents duplicate direct conversations", async () => {
    const repository = new MemoryRepository();
    await repository.saveProfile(profile("user-a", "کاربر الف"));
    await repository.saveProfile(profile("user-b", "کاربر ب"));

    const first = await repository.createDirectChat("user-a", "user-b");
    const second = await repository.createDirectChat("user-b", "user-a");

    expect(second.conversation.id).toBe(first.conversation.id);
  });

  it("keeps unauthorized users out of messages", async () => {
    const repository = new MemoryRepository();
    await repository.saveProfile(profile("owner", "مالک"));
    await repository.saveProfile(profile("member", "عضو"));
    await repository.saveProfile(profile("outsider", "بیرونی"));

    const group = await repository.createGroupChat("owner", "تیم محتوا", ["member"]);
    await expect(repository.listChatMessages("outsider", group.conversation.id)).rejects.toThrow("دسترسی");
  });

  it("sends messages idempotently and calculates unread counts", async () => {
    const repository = new MemoryRepository();
    await repository.saveProfile(profile("user-a", "کاربر الف"));
    await repository.saveProfile(profile("user-b", "کاربر ب"));
    const direct = await repository.createDirectChat("user-a", "user-b");

    const first = await repository.sendChatMessage("user-a", direct.conversation.id, "سلام", "client-1");
    const duplicate = await repository.sendChatMessage("user-a", direct.conversation.id, "سلام", "client-1");
    const inbox = await repository.listChatConversations("user-b");

    expect(duplicate.id).toBe(first.id);
    expect(inbox[0].unreadCount).toBe(1);

    await repository.markChatRead("user-b", direct.conversation.id);
    expect((await repository.listChatConversations("user-b"))[0].unreadCount).toBe(0);
  });

  it("paginates messages with a cursor", async () => {
    const repository = new MemoryRepository();
    await repository.saveProfile(profile("user-a", "کاربر الف"));
    await repository.saveProfile(profile("user-b", "کاربر ب"));
    const direct = await repository.createDirectChat("user-a", "user-b");

    for (let index = 0; index < 3; index += 1) {
      await repository.sendChatMessage("user-a", direct.conversation.id, `پیام ${index}`, `client-${index}`);
    }

    const firstPage = await repository.listChatMessages("user-b", direct.conversation.id, null, 2);
    const secondPage = await repository.listChatMessages("user-b", direct.conversation.id, firstPage.nextCursor, 2);

    expect(firstPage.messages).toHaveLength(2);
    expect(secondPage.messages).toHaveLength(1);
  });
});
