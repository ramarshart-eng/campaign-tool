# Generate brushes.json files from _brush marked folders
# Scans the Tilesets structure and creates brush entries for any folder with _brush suffix

$tilesetPath = "C:\Users\swamp\Documents\campaign-tool\public\assets\battlemap\Tilesets"

# Tool mapping for different categories
$categoryToolMap = @{
  "Structure" = @{
    "Walls" = "border"
    "Railings" = "border"
    "Doors" = "rectangle"
    "Stairs" = "rectangle"
    "Pillars" = "rectangle"
  }
  "Terrain" = @{
    "Floor" = "rectangle"
    "Ground" = "rectangle"
    "Water" = "rectangle"
    "Special_Surfaces" = "rectangle"
  }
  "Vegetation" = @{
    "Trees" = "rectangle"
    "Bushes" = "rectangle"
    "Grass" = "rectangle"
    "Flowers" = "rectangle"
  }
  "Decoration" = @{
    "Furniture" = "rectangle"
    "Objects" = "rectangle"
    "Torches" = "rectangle"
    "Rocks" = "rectangle"
    "Chains" = "border"
    "Banners" = "rectangle"
  }
  "Hazard" = @{
    "Fire" = "rectangle"
    "Spikes" = "rectangle"
    "Traps" = "rectangle"
    "Magical" = "rectangle"
  }
  "Lighting" = @{
    "Light_Sources" = "rectangle"
    "Shadow_Effects" = "rectangle"
  }
}

# Default layer mapping
$defaultLayerMap = @{
  "Structure" = "structure"
  "Terrain" = "floor"
  "Vegetation" = "nature"
  "Decoration" = "decoration"
  "Hazard" = "hazard"
  "Lighting" = "lighting"
}

function Get-ToolForSubcategory {
  param([string]$Category, [string]$Subcategory)
  
  if ($categoryToolMap[$Category] -and $categoryToolMap[$Category][$Subcategory]) {
    return $categoryToolMap[$Category][$Subcategory]
  }
  return "rectangle" # default
}

function ConvertTo-BrushId {
  param([string]$Text)
  $text = $text -replace '_brush$', '' # remove _brush suffix
  $text = $text.ToLower() -replace '\s+', '-' # spaces to hyphens
  return $text
}

function ConvertTo-TilesPath {
  param([string]$Text)
  return $text
}

# Process each category
Get-ChildItem -Path $tilesetPath -Directory | ForEach-Object {
  $category = $_.Name
  $categoryPath = $_.FullName
  
  Write-Host "=== $category ===" -ForegroundColor Cyan
  
  # Find all _brush marked folders
  $brushFolders = @()
  
  Get-ChildItem -Path $categoryPath -Directory | ForEach-Object {
    $subcategory = $_.Name
    $subcategoryPath = $_.FullName
    
    # Look for _brush folders within this subcategory
    Get-ChildItem -Path $subcategoryPath -Directory -ErrorAction SilentlyContinue | Where-Object {
      $_.Name -like "*_brush"
    } | ForEach-Object {
      $brushFolders += @{
        Subcategory = $subcategory
        FolderName = $_.Name
        RelativePath = "$subcategory/$(ConvertTo-TilesPath $_.Name)"
      }
    }
  }
  
  if ($brushFolders.Count -eq 0) {
    Write-Host "  No _brush folders found" -ForegroundColor Yellow
    return
  }
  
  # Group by subcategory for the brushes.json
  $grouped = $brushFolders | Group-Object -Property Subcategory
  
  # Create brushes structure
  $brushesData = @{
    version = 2
    tilesetId = $category
    palettes = @()
    tools = @(
      @{
        toolId = "border"
        label = "Border Tool"
        description = "Draw borders and outlines"
        toolType = "rectangle"
      },
      @{
        toolId = "rectangle"
        label = "Rectangle Tool"
        description = "Fill rectangular areas"
        toolType = "rectangle"
      }
    )
    brushes = @()
  }
  
  # Add brushes for each _brush folder found
  $grouped | ForEach-Object {
    $subcategory = $_.Name
    $tool = Get-ToolForSubcategory -Category $category -Subcategory $subcategory
    $layer = $defaultLayerMap[$category]
    
    $_.Group | ForEach-Object {
      $brushId = ConvertTo-BrushId $_.FolderName
      $label = $_.FolderName -replace '_brush$', '' # remove suffix for label
      $tilesPath = $_.RelativePath
      
      $brushesData.brushes += @{
        brushId = $brushId
        label = $label
        toolType = "rectangle"
        tilesetId = $category
        layer = $layer
        tilesPath = $tilesPath
      }
      
      Write-Host "  + $label" -ForegroundColor Green
      Write-Host "    Path: $tilesPath" -ForegroundColor Gray
      Write-Host "    Tool: $tool" -ForegroundColor Gray
    }
  }
  
  # Write brushes.json
  $brushesPath = Join-Path $categoryPath "brushes.json"
  $json = $brushesData | ConvertTo-Json -Depth 10
  $encoding = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($brushesPath, $json, $encoding)
  Write-Host "  Created $brushesPath" -ForegroundColor Green
}

Write-Host "Scan Complete" -ForegroundColor Cyan

