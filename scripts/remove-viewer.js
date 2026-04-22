const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const viewer = await prisma.role.findUnique({ where: { name: 'Viewer' } });
    if (!viewer) {
      console.log('No Viewer role found');
      return process.exit(0);
    }

    const users = await prisma.user.findMany({ where: { roleId: viewer.id } });
    const userIds = users.map(u => u.id);
    console.log(`Found ${users.length} Viewer user(s): ${users.map(u => u.username).join(', ') || '(none)'}`);

    if (userIds.length > 0) {
      const delAudit = await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
      console.log(`  - Deleted ${delAudit.count} audit log(s)`);

      const delHistory = await prisma.ropaHistory.deleteMany({ where: { changedById: { in: userIds } } });
      console.log(`  - Deleted ${delHistory.count} ROPA history entries`);

      const upd = await prisma.ropaRecord.updateMany({
        where: { updatedById: { in: userIds } },
        data: { updatedById: null }
      });
      console.log(`  - Cleared updatedBy on ${upd.count} ROPA record(s)`);

      const createdCount = await prisma.ropaRecord.count({ where: { createdById: { in: userIds } } });
      if (createdCount > 0) {
        console.log(`  ! ${createdCount} ROPA record(s) created by Viewer — cannot delete user`);
        console.log(`    Reassign createdBy manually or delete those records first.`);
        return process.exit(1);
      }

      const delUsers = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      console.log(`  - Deleted ${delUsers.count} user(s)`);
    }

    const delRole = await prisma.role.delete({ where: { id: viewer.id } });
    console.log(`Deleted role: ${delRole.name}`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
