<?php
namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SettingsTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        DB::table('settings')->delete();

        $data = [
            ['type' => 'current_session', 'description' => '2026-2027'],
            ['type' => 'system_title', 'description' => 'SOI'],
            ['type' => 'system_name', 'description' => 'SCHOOLOS INTERNATIONAL SCHOOL'],
            ['type' => 'term_ends', 'description' => '30/09/2026'],
            ['type' => 'term_begins', 'description' => '01/04/2026'],
            ['type' => 'phone', 'description' => '+91 98765 43210'],
            ['type' => 'address', 'description' => '12, MG Road, Bengaluru, Karnataka 560001'],
            ['type' => 'system_email', 'description' => 'office@school.example.in'],
            ['type' => 'alt_email', 'description' => ''],
            ['type' => 'email_host', 'description' => ''],
            ['type' => 'email_pass', 'description' => ''],
            ['type' => 'lock_exam', 'description' => 0],
            ['type' => 'logo', 'description' => ''],
            ['type' => 'next_term_fees_j', 'description' => '42000'],
            ['type' => 'next_term_fees_pn', 'description' => '30000'],
            ['type' => 'next_term_fees_p', 'description' => '45000'],
            ['type' => 'next_term_fees_n', 'description' => '36000'],
            ['type' => 'next_term_fees_s', 'description' => '52000'],
            ['type' => 'next_term_fees_c', 'description' => '24000'],
        ];

        DB::table('settings')->insert($data);

    }
}
