<?php
$dir = "trainingDigits/";
$sdir = "largeTrainingDigits/";

$data_all = array();
if (!is_dir($sdir)) {
    mkdir($sdir);
}

// Open a known directory, and proceed to read its contents
if (is_dir($dir)) {
    if ($dh = opendir($dir)) {
        while (($file = readdir($dh)) !== false) {
            if ($file !== '.' && $file !== '..' && $file !== 'index.php') {              
                $data  = file($dir . $file);
                
                $raw = '';
                
                for ($i=0; $i < 8; $i++) {
                    $raw .= implode('', array_pad(array(), 320, 0)) . "\n";
                }
                
                for ($i=0; $i < count($data); $i++) {
                    $x = '';
                    $x .= implode('', array_pad(array(), 48, 0));
                    
                    $oldrow = $data[$i];
                    
                    for ($k=0; $k < 32; $k++) {
                        for ($j=0; $j < 7; $j++) {
                            $x .= $oldrow[$k];
                        }
                    }
                    $x .= implode('', array_pad(array(), 48, 0));
                    $x .= "\n";
                    
                    for ($j=0; $j < 7; $j++) {
                        $raw .= $x;
                    }
                    
                }
                
                for ($i=0; $i < 8; $i++) {
                    $raw .= implode('', array_pad(array(), 320, 0));
                    $raw .= ($i < 7) ? "\n":"";
                }
                
                file_put_contents($sdir . $file, $raw);
                //break;
            }
            
        }
        closedir($dh);
    }
    
    echo 'Done.';
}
?>