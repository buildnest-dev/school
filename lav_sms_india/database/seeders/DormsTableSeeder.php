<?php
namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DormsTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        DB::table('dorms')->delete();
        $data = [
            ['name' => 'Ganga House'],
            ['name' => 'Yamuna House'],
            ['name' => 'Kaveri House'],
            ['name' => 'Godavari House'],
            ['name' => 'Narmada House'],
        ];
        DB::table('dorms')->insert($data);
    }
}
