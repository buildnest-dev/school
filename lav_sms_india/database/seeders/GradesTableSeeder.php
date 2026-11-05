<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class GradesTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        DB::table('grades')->delete();

        $this->createGrades();
    }

    protected function createGrades()
    {

        $d = [

            ['name' => 'A1', 'mark_from' => 91, 'mark_to' => 100, 'remark' => 'Outstanding'],
            ['name' => 'A2', 'mark_from' => 81, 'mark_to' => 90, 'remark' => 'Excellent'],
            ['name' => 'B1', 'mark_from' => 71, 'mark_to' => 80, 'remark' => 'Very Good'],
            ['name' => 'B2', 'mark_from' => 61, 'mark_to' => 70, 'remark' => 'Good'],
            ['name' => 'C1', 'mark_from' => 51, 'mark_to' => 60, 'remark' => 'Fair'],
            ['name' => 'C2', 'mark_from' => 41, 'mark_to' => 50, 'remark' => 'Average'],
            ['name' => 'D', 'mark_from' => 33, 'mark_to' => 40, 'remark' => 'Pass'],
            ['name' => 'E', 'mark_from' => 0, 'mark_to' => 32, 'remark' => 'Needs Improvement'],

        ];
        DB::table('grades')->insert($d);
    }
}
