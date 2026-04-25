/**
 * SavedIdealTarget 엔티티가 synchronize 시 생성할 실제 DDL 을 dump.
 * 사용:
 *   psql -c "CREATE DATABASE yeon_schema_dump_tmp;"
 *   psql -d yeon_schema_dump_tmp -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
 *   npx ts-node scripts/dump-saved-ideal-target-sql.ts
 *   psql -c "DROP DATABASE yeon_schema_dump_tmp;"
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { SajuProfile } from '../src/saju/entities/saju-profile.entity';
import { SavedIdealTarget } from '../src/matching/entities/saved-ideal-target.entity';

async function main(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'kyungtaewoo',
    password: '',
    database: 'yeon_schema_dump_tmp',
    entities: [User, SajuProfile, SavedIdealTarget],
    synchronize: false,
    logging: false,
  });
  await ds.initialize();

  const sqlInMemory = await ds.driver.createSchemaBuilder().log();
  console.log('==== UP queries (CREATE) ====');
  for (const q of sqlInMemory.upQueries) {
    console.log(q.query + ';');
  }
  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
