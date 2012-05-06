<?php 
class MyDB extends SQLite3
{
    function __construct()
    {
        $this->open('mysqlitedb.db');
    }
}

$db = new MyDB();

$db->exec('CREATE TABLE IF NOT EXISTS glyphs (type int not null, data text not null)');
$db->exec("INSERT INTO glyphs VALUES ('".$_POST['type']."', '".sqlite_escape_string($_POST['data'])."')");
$db->close();