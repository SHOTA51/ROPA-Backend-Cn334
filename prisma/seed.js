const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding database...')

    // 1. Create Roles
    const roles = ['Admin', 'DataOwner', 'DPO', 'Auditor', 'Executive']
    for (const name of roles) {
        await prisma.role.upsert({
            where: { name },
            update: {},
            create: { name }
        })
    }
    console.log('Roles created:', roles.join(', '))

    // 2. Create Departments
    const departments = ['HR', 'Marketing', 'IT', 'Finance', 'Legal']
    for (const name of departments) {
        await prisma.department.upsert({
            where: { name },
            update: {},
            create: { name }
        })
    }
    console.log('Departments created:', departments.join(', '))

    // 3. Create Admin user
    const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } })
    const itDept = await prisma.department.findUnique({ where: { name: 'IT' } })

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash('admin123', salt)

    await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            email: 'admin@ropa.com',
            name: 'System Admin',
            password: hashedPassword,
            roleId: adminRole.id,
            departmentId: itDept.id
        }
    })
    console.log('Admin user created: admin / admin123')

    // 4. Create sample DPO user
    const dpoRole = await prisma.role.findUnique({ where: { name: 'DPO' } })
    const legalDept = await prisma.department.findUnique({ where: { name: 'Legal' } })

    const dpoPassword = await bcrypt.hash('dpo123', salt)
    await prisma.user.upsert({
        where: { username: 'dpo' },
        update: {},
        create: {
            username: 'dpo',
            email: 'dpo@ropa.com',
            name: 'Jane DPO',
            password: dpoPassword,
            roleId: dpoRole.id,
            departmentId: legalDept.id
        }
    })
    console.log('DPO user created: dpo / dpo123')

    // 5. Create sample DataOwner user
    const dataOwnerRole = await prisma.role.findUnique({ where: { name: 'DataOwner' } })
    const hrDept = await prisma.department.findUnique({ where: { name: 'HR' } })

    const ownerPassword = await bcrypt.hash('owner123', salt)
    await prisma.user.upsert({
        where: { username: 'dataowner' },
        update: {},
        create: {
            username: 'dataowner',
            email: 'dataowner@ropa.com',
            name: 'John DataOwner',
            password: ownerPassword,
            roleId: dataOwnerRole.id,
            departmentId: hrDept.id
        }
    })
    console.log('DataOwner user created: dataowner / owner123')

    console.log('\nSeed completed!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
