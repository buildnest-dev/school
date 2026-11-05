<?php
namespace Database\Seeders;

use App\Models\Lga;
use App\Models\State;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * The 'lgas' table stores Districts in this Indian edition (the table name is kept so no
 * migration changes are needed). This is a starter list of major districts per state/UT,
 * not the full list of ~780 districts: add more rows here or through a CSV import.
 */
class LgasTableSeeder extends Seeder
{

    public function run()
    {
        DB::table('lgas')->delete();

        $districts = [
            'Andhra Pradesh' => ['Visakhapatnam', 'Krishna', 'Guntur', 'Chittoor', 'Anantapur'],
            'Arunachal Pradesh' => ['Papum Pare', 'Tawang', 'West Siang', 'Lohit'],
            'Assam' => ['Kamrup Metropolitan', 'Dibrugarh', 'Cachar', 'Jorhat', 'Nagaon'],
            'Bihar' => ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga'],
            'Chhattisgarh' => ['Raipur', 'Bilaspur', 'Durg', 'Korba', 'Bastar'],
            'Goa' => ['North Goa', 'South Goa'],
            'Gujarat' => ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'],
            'Haryana' => ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Hisar'],
            'Himachal Pradesh' => ['Shimla', 'Kangra', 'Mandi', 'Solan', 'Kullu'],
            'Jharkhand' => ['Ranchi', 'Dhanbad', 'Bokaro', 'East Singhbhum', 'Hazaribagh'],
            'Karnataka' => ['Bengaluru Urban', 'Mysuru', 'Dharwad', 'Belagavi', 'Dakshina Kannada'],
            'Kerala' => ['Thiruvananthapuram', 'Ernakulam', 'Kozhikode', 'Thrissur', 'Kannur'],
            'Madhya Pradesh' => ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain'],
            'Maharashtra' => ['Mumbai City', 'Mumbai Suburban', 'Pune', 'Nagpur', 'Nashik', 'Thane'],
            'Manipur' => ['Imphal West', 'Imphal East', 'Churachandpur', 'Thoubal'],
            'Meghalaya' => ['East Khasi Hills', 'West Garo Hills', 'Ri-Bhoi'],
            'Mizoram' => ['Aizawl', 'Lunglei', 'Champhai'],
            'Nagaland' => ['Kohima', 'Dimapur', 'Mokokchung'],
            'Odisha' => ['Khordha', 'Cuttack', 'Ganjam', 'Sambalpur', 'Puri'],
            'Punjab' => ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'SAS Nagar (Mohali)'],
            'Rajasthan' => ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
            'Sikkim' => ['East Sikkim', 'West Sikkim', 'North Sikkim', 'South Sikkim'],
            'Tamil Nadu' => ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
            'Telangana' => ['Hyderabad', 'Rangareddy', 'Warangal', 'Karimnagar', 'Nizamabad'],
            'Tripura' => ['West Tripura', 'South Tripura', 'Dhalai'],
            'Uttar Pradesh' => ['Lucknow', 'Kanpur Nagar', 'Varanasi', 'Agra', 'Prayagraj', 'Gautam Buddha Nagar'],
            'Uttarakhand' => ['Dehradun', 'Haridwar', 'Nainital', 'Udham Singh Nagar'],
            'West Bengal' => ['Kolkata', 'Howrah', 'North 24 Parganas', 'Darjeeling', 'Paschim Bardhaman'],
            'Andaman and Nicobar Islands' => ['South Andaman', 'North and Middle Andaman', 'Nicobar'],
            'Chandigarh' => ['Chandigarh'],
            'Dadra and Nagar Haveli and Daman and Diu' => ['Dadra and Nagar Haveli', 'Daman', 'Diu'],
            'Delhi' => ['New Delhi', 'Central Delhi', 'South Delhi', 'North Delhi', 'East Delhi', 'West Delhi'],
            'Jammu and Kashmir' => ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla'],
            'Ladakh' => ['Leh', 'Kargil'],
            'Lakshadweep' => ['Lakshadweep'],
            'Puducherry' => ['Puducherry', 'Karaikal'],
        ];

        foreach ($districts as $state_name => $names) {
            $state_id = State::where('name', $state_name)->value('id');
            foreach ($names as $name) {
                Lga::create(['state_id' => $state_id, 'name' => $name]);
            }
        }
    }

}
