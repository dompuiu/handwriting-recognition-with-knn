<?php 
ini_set('memory_limit','512M');
ini_set('max_execution_time','0');

$sdir = "trainingSetJson/";

if (!is_dir($sdir)) {
    mkdir($sdir);
}

class MyDB extends SQLite3
{
    function __construct()
    {
        $this->open('mysqlitedb.db');
    }
}

$db = new MyDB();
$types = array(0,1,2,3,4,5,6,7,8,9);
foreach ($types as $type) {
    $result = '[';
    $comma = false;
    $results = $db->query("SELECT data FROM glyphs WHERE type = $type");
    while ($row = $results->fetchArray(SQLITE3_ASSOC)) {
        if ($comma) {
            $result .= ',';
        }
        
        if (!$comma) {
            $comma = true;
        }
        
        $result .= $row['data'];
    }
    $result .= ']';
    file_put_contents($sdir . $type . '.json', $result);
}
$db->close();
echo 'Done.';