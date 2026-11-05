<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ClassTypesTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        DB::table('class_types')->delete();

        $data = [
            ['name' => 'Playgroup', 'code' => 'C'],
            ['name' => 'Nursery', 'code' => 'PN'],
            ['name' => 'Pre-Primary (LKG/UKG)', 'code' => 'N'],
            ['name' => 'Primary (Class 1-5)', 'code' => 'P'],
            ['name' => 'Middle (Class 6-8)', 'code' => 'J'],
            ['name' => 'Secondary & Senior Secondary (Class 9-12)', 'code' => 'S'],
        ];

        DB::table('class_types')->insert($data);

    }
}
